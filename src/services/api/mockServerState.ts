// src/services/api/mockServerState.ts
/**
 * Simulated server-side state for MockApiAdapter.
 *
 * This module stands in for the university backend until the real API exists.
 * It is the only writer of the per-student verification ledger and membership record,
 * and it is the only place where "is this receipt valid and what does it grant"
 * is decided. Client stores cache its answers and nothing more.
 *
 * Known limitation, stated plainly: because there is no server yet, this state
 * is persisted on the device. A user with direct storage access can still edit
 * it. That is not a boundary this file can enforce — it becomes a real boundary
 * the moment UniversityApiAdapter replaces the mock, and because the client
 * already treats these results as authoritative, that swap needs no client
 * changes. What this file *does* fix is that the decision no longer happens in
 * UI code, is no longer racy, and no longer fails open when storage is damaged.
 */
import type { Membership } from '../../types/membership';
import type {
  ReceiptData,
  ReceiptRejectionCode,
  ReceiptValidationContext,
  ReceiptValidationResult,
} from '../../types/api';
import { readJson, readJsonWith, writeJson } from '../persistence';
import { isMembership, parseMembership } from '../schemas';
import {
  SERVER_STATE_KEYS,
  MEMBERSHIP_DAYS_PER_RECEIPT,
} from '../../core/constants';
import {
  normalizePersonName,
  normalizeStudentNumber,
  parseCalendarDateUtc,
  todayUtcMidnight,
} from './receiptRules';
import { migrateLegacyStudentNumber, migrateLegacyUserId } from '../../utils/studentNumber';

interface LedgerEntry {
  /** Null only for legacy records whose payment date was not stored. */
  paymentDate: string | null;
  studentNumber: string;
  redeemedAtIso: string;
}

type MembershipsByUser = Record<string, Membership>;

/** Raised when state could not be read, so no verdict can be issued safely. */
export class LedgerUnavailableError extends Error {
  constructor() {
    super('Receipt ledger is unavailable');
    this.name = 'LedgerUnavailableError';
  }
}

// ── Shape guards ─────────────────────────────────────────────────────────────

function parseLedger(value: unknown): LedgerEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: LedgerEntry[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const entry = item as Record<string, unknown>;
    if (typeof entry.studentNumber !== 'string' || typeof entry.redeemedAtIso !== 'string') return null;
    let paymentDate: string | null;
    if (entry.paymentDate === null) {
      paymentDate = null;
    } else if (typeof entry.paymentDate === 'string' && parseCalendarDateUtc(entry.paymentDate) !== null) {
      paymentDate = entry.paymentDate;
    } else if (entry.paymentDate === undefined && typeof entry.ref === 'string' && entry.ref.length > 0) {
      // Read-only migration from pre-simplification bank references. Other old
      // formats contain no date: preserve the history without inventing one.
      const parts = /^(\d{2})[./-](\d{2})[./-](\d{4})[./-]/.exec(entry.ref);
      const iso = parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : null;
      paymentDate = iso && parseCalendarDateUtc(iso) !== null ? iso : null;
    } else {
      return null;
    }
    entries.push({ paymentDate, studentNumber: migrateLegacyStudentNumber(entry.studentNumber), redeemedAtIso: entry.redeemedAtIso });
  }
  return entries;
}

function isMembershipsByUser(value: unknown): value is MembershipsByUser {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isMembership);
}

// ── Serialisation ────────────────────────────────────────────────────────────

/**
 * All state access runs through one queue.
 *
 * Redemption is a read-modify-write across two keys. Interleaving two of them
 * let both callers observe the same pre-state, both pass the duplicate check,
 * and the second write clobber the first — extending the membership twice while
 * losing a verification from the ledger. Queueing removes the interleaving at the
 * only layer that can actually guarantee it.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const run = queue.then(operation, operation);
  queue = run.catch(() => undefined);
  return run;
}

// ── State access ─────────────────────────────────────────────────────────────

async function loadLedger(): Promise<LedgerEntry[]> {
  const outcome = await readJsonWith(SERVER_STATE_KEYS.RECEIPT_LEDGER, parseLedger);
  if (outcome.status === 'corrupt') throw new LedgerUnavailableError();
  if (outcome.status === 'empty') return [];
  return outcome.value;
}

/**
 * Records written by earlier builds are keyed "user-STD…" and carry plan /
 * quota fields. They are re-keyed and trimmed in memory on read; the next
 * redemption writes the whole map back, which persists the cleaned form.
 */
async function loadMemberships(): Promise<MembershipsByUser> {
  const outcome = await readJson(
    SERVER_STATE_KEYS.MEMBERSHIP_RECORD,
    isMembershipsByUser
  );
  if (outcome.status === 'corrupt') throw new LedgerUnavailableError();
  if (outcome.status === 'empty') return {};

  const migrated: MembershipsByUser = {};
  for (const [key, stored] of Object.entries(outcome.value)) {
    const record = parseMembership(stored);
    if (!record) throw new LedgerUnavailableError();
    const userId = migrateLegacyUserId(key);
    migrated[userId] = {
      ...record,
      userId: migrateLegacyUserId(record.userId),
      id: record.id.replace(/^mem-user-STD/i, 'mem-user-'),
    };
  }
  return migrated;
}

// ── Derived values ───────────────────────────────────────────────────────────

function userIdFor(studentNumber: string): string {
  // Deterministic, so re-binding the same student number keeps one identity
  // instead of minting a fresh `user-<timestamp>` on every scan.
  return `user-${studentNumber}`;
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.max(0, Math.ceil((toMs - fromMs) / 86_400_000));
}

/** Re-derive the display fields from the server's clock. */
function withCurrentStanding(membership: Membership, nowMs: number): Membership {
  const expiryMs = new Date(membership.expiryDate).getTime();
  const daysRemaining = daysBetween(nowMs, expiryMs);
  return {
    ...membership,
    daysRemaining,
    status: daysRemaining > 0 ? 'active' : 'expired',
  };
}

function reject(
  receipt: ReceiptData,
  error: ReceiptRejectionCode
): ReceiptValidationResult {
  return { success: false, receipt, error };
}

// ── Public operations ────────────────────────────────────────────────────────

export const mockServerState = {
  /**
   * Adjudicate a receipt and, if it passes every rule, redeem it.
   *
   * Returns a verdict rather than throwing for policy refusals; it only throws
   * when state is unreadable, which the adapter maps to LEDGER_UNAVAILABLE so
   * the UI refuses the activation instead of granting it.
   */
  redeemReceipt(
    receipt: ReceiptData,
    context: ReceiptValidationContext
  ): Promise<ReceiptValidationResult> {
    return serialize(async () => {
      // 1. Identity fields must both be present. An absent student number used
      //    to satisfy the ownership check by defaulting to "matches".
      const receiptName = normalizePersonName(receipt.studentName);
      if (!receiptName) return reject(receipt, 'NO_NAME');

      if (!receipt.studentNumber?.trim()) return reject(receipt, 'NO_STUDENT_NUMBER');
      const receiptStudentNumber = normalizeStudentNumber(receipt.studentNumber);
      if (!receiptStudentNumber) return reject(receipt, 'INVALID_STUDENT_NUMBER');

      // 2. Ownership. Both fields must match the bound identity — a receipt that
      //    matches only on name, or only on number, belongs to someone else.
      if (context.boundStudentNumber !== null) {
        const boundNumber = normalizeStudentNumber(context.boundStudentNumber);
        const boundName = normalizePersonName(context.boundFullName);

        // An unreadable bound number can never match, which refuses the receipt.
        if (boundNumber === null || receiptStudentNumber !== boundNumber) {
          return reject(receipt, 'ID_MISMATCH');
        }
        if (boundName && receiptName !== boundName) {
          return reject(receipt, 'NAME_MISMATCH');
        }
      }

      // 3. Strict payment date. Past payments have no age limit.
      if (!receipt.paymentDate) return reject(receipt, 'NO_DATE');

      const paidUtc = parseCalendarDateUtc(receipt.paymentDate);
      if (paidUtc === null) return reject(receipt, 'INVALID_DATE');

      const now = new Date();
      const nowMs = now.getTime();
      if (paidUtc > todayUtcMidnight(now)) return reject(receipt, 'FUTURE_DATE');

      // 4. With only identity and date, one payment per student per date can be
      //    distinguished. Repeat confirmation returns the existing entitlement.
      //    Different students can verify the same payment date independently.
      const ledger = await loadLedger();
      const memberships = await loadMemberships();
      const userId = userIdFor(receiptStudentNumber);
      const existing = memberships[userId];
      const alreadyVerified = ledger.some((entry) =>
        entry.studentNumber === receiptStudentNumber && entry.paymentDate === receipt.paymentDate
      );
      if (alreadyVerified) {
        if (!existing) throw new LedgerUnavailableError();
        const membership = withCurrentStanding(existing, nowMs);
        return {
          success: true,
          receipt,
          identity: { studentNumber: receiptStudentNumber, fullName: receipt.studentName?.trim() ?? '' },
          membership,
          membershipExpiryDate: membership.expiryDate,
        };
      }

      // 5. Old receipts activate today. Early renewals preserve the remaining
      //    balance by extending from the later of activation and current expiry.
      const existingExpiryMs = existing ? new Date(existing.expiryDate).getTime() : 0;
      const expiry = new Date(Math.max(nowMs, existingExpiryMs));
      expiry.setUTCDate(expiry.getUTCDate() + MEMBERSHIP_DAYS_PER_RECEIPT);

      const granted: Membership = {
        id: existing?.id ?? `mem-${userId}`,
        userId,
        status: 'active',
        startDate: existing?.startDate ?? now.toISOString(),
        expiryDate: expiry.toISOString(),
        daysRemaining: daysBetween(nowMs, expiry.getTime()),
      };

      // 6. Commit. The ledger is written first: if the second write fails the
      //    receipt is already spent, which refuses a replay rather than allowing
      //    one. We attempt to undo it so an honest user is not penalised, but a
      //    failed undo still errs toward refusal.
      // Keep all verification dates: without an age limit, dropping an entry
      // would let an old payment extend access a second time.
      const updatedLedger = [
        { paymentDate: receipt.paymentDate, studentNumber: receiptStudentNumber, redeemedAtIso: now.toISOString() },
        ...ledger,
      ];

      await writeJson(SERVER_STATE_KEYS.RECEIPT_LEDGER, updatedLedger);

      try {
        await writeJson(SERVER_STATE_KEYS.MEMBERSHIP_RECORD, {
          ...memberships,
          [userId]: granted,
        });
      } catch (error) {
        await writeJson(SERVER_STATE_KEYS.RECEIPT_LEDGER, ledger).catch(() => {});
        throw error;
      }

      return {
        success: true,
        receipt,
        identity: {
          studentNumber: receiptStudentNumber,
          fullName: receipt.studentName?.trim() ?? '',
        },
        membership: granted,
        membershipExpiryDate: granted.expiryDate,
      };
    });
  },

  /** Current standing for a user, recomputed against the server's clock. */
  readMembership(userId: string): Promise<Membership | null> {
    return serialize(async () => {
      const memberships = await loadMemberships();
      const record = memberships[userId];
      if (!record) return null;
      return withCurrentStanding(record, Date.now());
    });
  },
};

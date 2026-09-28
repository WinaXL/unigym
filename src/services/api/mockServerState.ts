// src/services/api/mockServerState.ts
/**
 * Simulated server-side state for MockApiAdapter.
 *
 * This module stands in for the university backend until the real API exists.
 * It is the only writer of the spent-receipt ledger and the membership record,
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
import { readJson, writeJson } from '../persistence';
import { isMembership } from '../schemas';
import {
  SERVER_STATE_KEYS,
  MAX_RECEIPT_AGE_DAYS,
  MEMBERSHIP_DAYS_PER_RECEIPT,
  RECEIPT_LEDGER_MAX_ENTRIES,
} from '../../core/constants';
import {
  normalizeReferenceId,
  normalizePersonName,
  normalizeStudentNumber,
  parseCalendarDateUtc,
  utcDayDiff,
  todayUtcMidnight,
} from './receiptRules';

interface LedgerEntry {
  ref: string;
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

function isLedgerEntry(value: unknown): value is LedgerEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.ref === 'string' &&
    entry.ref.length > 0 &&
    typeof entry.studentNumber === 'string' &&
    typeof entry.redeemedAtIso === 'string'
  );
}

function isLedger(value: unknown): value is LedgerEntry[] {
  return Array.isArray(value) && value.every(isLedgerEntry);
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
 * losing a reference from the ledger. Queueing removes the interleaving at the
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
  const outcome = await readJson(SERVER_STATE_KEYS.RECEIPT_LEDGER, isLedger);
  if (outcome.status === 'corrupt') throw new LedgerUnavailableError();
  return outcome.status === 'ok' ? outcome.value : [];
}

async function loadMemberships(): Promise<MembershipsByUser> {
  const outcome = await readJson(
    SERVER_STATE_KEYS.MEMBERSHIP_RECORD,
    isMembershipsByUser
  );
  if (outcome.status === 'corrupt') throw new LedgerUnavailableError();
  return outcome.status === 'ok' ? outcome.value : {};
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
      // 1. Reference must be well-formed before anything else, so that a
      //    malformed value can never become a novel ledger entry.
      const ref = normalizeReferenceId(receipt.referenceId);
      if (!ref) return reject(receipt, 'INVALID_REFERENCE');

      // 2. Identity fields must both be present. An absent student number used
      //    to satisfy the ownership check by defaulting to "matches".
      const receiptName = normalizePersonName(receipt.studentName);
      if (!receiptName) return reject(receipt, 'NO_NAME');

      const receiptStudentNumber = normalizeStudentNumber(receipt.studentNumber);
      if (!receiptStudentNumber) return reject(receipt, 'NO_STUDENT_NUMBER');

      // 3. Ownership. Both fields must match the bound identity — a receipt that
      //    matches only on name, or only on number, belongs to someone else.
      if (context.boundStudentNumber !== null) {
        const boundNumber = normalizeStudentNumber(context.boundStudentNumber);
        const boundName = normalizePersonName(context.boundFullName);

        if (receiptStudentNumber !== boundNumber) {
          return reject(receipt, 'ID_MISMATCH');
        }
        if (boundName && receiptName !== boundName) {
          return reject(receipt, 'NAME_MISMATCH');
        }
      }

      // 4. Payment date, in strict YYYY-MM-DD, inside the freshness window.
      if (!receipt.paymentDate) return reject(receipt, 'NO_DATE');

      const paidUtc = parseCalendarDateUtc(receipt.paymentDate);
      if (paidUtc === null) return reject(receipt, 'INVALID_DATE');

      const now = new Date();
      const nowMs = now.getTime();
      const ageDays = utcDayDiff(todayUtcMidnight(now), paidUtc);

      if (ageDays < 0) return reject(receipt, 'FUTURE_DATE');
      if (ageDays > MAX_RECEIPT_AGE_DAYS) return reject(receipt, 'DATE_EXPIRED');

      // 5. Replay check. Throws rather than defaulting to an empty ledger, so a
      //    damaged ledger refuses the redemption instead of permitting every
      //    receipt ever used.
      const ledger = await loadLedger();
      if (ledger.some((entry) => entry.ref === ref)) {
        return reject(receipt, 'ALREADY_USED');
      }

      const memberships = await loadMemberships();
      const userId = userIdFor(receiptStudentNumber);
      const existing = memberships[userId];

      // 6. Entitlement, computed here and nowhere else. Extend from the later of
      //    the current expiry and the payment date, so renewing early adds to
      //    the remaining balance instead of discarding it.
      const paidDate = new Date(paidUtc);
      const existingExpiryMs = existing ? new Date(existing.expiryDate).getTime() : 0;
      const expiry = new Date(Math.max(paidUtc, existingExpiryMs));
      expiry.setUTCDate(expiry.getUTCDate() + MEMBERSHIP_DAYS_PER_RECEIPT);

      const granted: Membership = {
        id: existing?.id ?? `mem-${userId}`,
        userId,
        status: 'active',
        plan: existing?.plan ?? 'Monthly Unlimited',
        startDate: existing?.startDate ?? paidDate.toISOString(),
        expiryDate: expiry.toISOString(),
        daysRemaining: daysBetween(nowMs, expiry.getTime()),
        quotaType: 'unlimited',
      };

      // 7. Commit. The ledger is written first: if the second write fails the
      //    receipt is already spent, which refuses a replay rather than allowing
      //    one. We attempt to undo it so an honest user is not penalised, but a
      //    failed undo still errs toward refusal.
      const trimmedLedger = [
        { ref, studentNumber: receiptStudentNumber, redeemedAtIso: now.toISOString() },
        ...ledger,
      ].slice(0, RECEIPT_LEDGER_MAX_ENTRIES);

      await writeJson(SERVER_STATE_KEYS.RECEIPT_LEDGER, trimmedLedger);

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

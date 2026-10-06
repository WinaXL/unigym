// src/services/api/receiptRules.ts
/**
 * Receipt normalisation and matching rules.
 *
 * These belong to the *server* side of the trust boundary. They live here
 * because MockApiAdapter currently stands in for the university backend; when
 * UniversityApiAdapter takes over, the real service owns this logic and this
 * file goes away. Client code must not import it — otherwise the client starts
 * making entitlement decisions again, which is the flaw this whole layer exists
 * to remove.
 */
import { isCalendarDate } from '../schemas';
import { isStudentNumber } from '../../utils/studentNumber';
import { canonicalReferenceId } from '../../utils/referenceId';

/**
 * Canonical form of a receipt reference. Returns null when the value could
 * never be a real reference, so a malformed ID is refused outright rather than
 * being stored as a novel ledger entry that a variant spelling could dodge.
 */
export function normalizeReferenceId(raw: string | undefined | null): string | null {
  return canonicalReferenceId(raw);
}

/** Characters OCR commonly reads interchangeably, folded to one representative. */
const OCR_CONFUSABLES: Record<string, string> = {
  O: '0',
  Q: '0',
  I: '1',
  L: '1',
  S: '5',
  B: '8',
  Z: '2',
};

/**
 * Key used to decide whether a reference has already been redeemed.
 *
 * The reference is read by OCR, so two photos of one receipt can spell it
 * differently ("RCP-482913" / "RCP482913", "O" / "0"). Comparing canonical
 * strings would treat each misreading as a fresh receipt. Dropping dashes and
 * folding confusable characters makes those variants collide; the cost is that
 * two genuinely distinct references differing only in such characters are
 * also treated as one, which errs toward refusing rather than allowing reuse.
 */
export function referenceReplayKey(canonical: string): string {
  return canonical
    .replace(/-/g, '')
    .replace(/[OQILSBZ]/g, (char) => OCR_CONFUSABLES[char]);
}

/**
 * Canonical form of a person's name: Unicode-stable, case-folded, with internal
 * whitespace collapsed. Diacritics are preserved so "Şahin" and "Sahin" remain
 * distinct — names are compared for equality, never by substring, because
 * substring matching let a single character satisfy the ownership check.
 */
export function normalizePersonName(raw: string | undefined | null): string {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Canonical form of a student number, or null if it is not purely numeric.
 *
 * NFKC folds full-width digits to ASCII, and spaces and dashes are treated as
 * formatting ("2314 1035", "2314-1035"). Any other character — including an
 * "STD" prefix — makes the value invalid rather than being silently stripped,
 * so "STD23141035" and "23141035" can never be treated as the same student.
 */
export function normalizeStudentNumber(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const compact = raw.normalize('NFKC').replace(/[\s\-\u2010-\u2015\u2212]/g, '');
  return isStudentNumber(compact) ? compact : null;
}

/**
 * Parse a strict YYYY-MM-DD calendar date into UTC midnight.
 *
 * Only this one format is accepted. Handing the string to `new Date()` would
 * also accept locale-dependent forms such as "09/27/2026" whose meaning varies
 * by engine and timezone, which makes the freshness window unpredictable.
 */
export function parseCalendarDateUtc(raw: string | undefined | null): number | null {
  if (!isCalendarDate(raw)) return null;
  const [year, month, day] = raw.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Whole-day difference between two UTC-midnight timestamps. */
export function utcDayDiff(laterUtcMs: number, earlierUtcMs: number): number {
  return Math.round((laterUtcMs - earlierUtcMs) / 86_400_000);
}

/** Today at UTC midnight, for comparing against a calendar date. */
export function todayUtcMidnight(now: Date = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

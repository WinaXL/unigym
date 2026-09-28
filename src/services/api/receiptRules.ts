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

/** Unicode dash variants that OCR and copy-paste routinely substitute for '-'. */
const DASH_VARIANTS = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;

/**
 * Canonical form of a receipt reference. Returns null when the value could
 * never be a real reference, so a malformed ID is refused outright rather than
 * being stored as a novel ledger entry that a variant spelling could dodge.
 *
 * Whitespace is stripped entirely and dash variants are folded, so
 * "rcp 123-456", "RCP–123456" and "RCP-123456" all collapse to one entry.
 */
export function normalizeReferenceId(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;

  const canonical = raw
    .normalize('NFKC')
    .replace(DASH_VARIANTS, '-')
    .replace(/\s+/g, '')
    .toUpperCase();

  // Must start alphanumeric, then alphanumerics/dashes, 4..32 chars total.
  if (!/^[A-Z0-9][A-Z0-9-]{3,31}$/.test(canonical)) return null;
  return canonical;
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

/** Canonical form of a student number: alphanumerics only, uppercased. */
export function normalizeStudentNumber(raw: string | undefined | null): string {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFKC').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
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

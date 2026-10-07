// src/utils/referenceId.ts

/** Unicode dash variants that OCR and copy-paste routinely substitute for '-'. */
const DASH_VARIANTS = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;

/** Starts alphanumeric, then alphanumerics/dashes, 4..32 characters total. */
const REFERENCE_ID_PATTERN = /^[A-Z0-9][A-Z0-9-]{3,31}$/;

/**
 * Canonical spelling of a receipt reference, or null if the value could never
 * be one. Whitespace is stripped and dash variants are folded, so
 * "rcp 123-456", "RCP–123456" and "RCP-123456" all collapse to one form.
 */
export function canonicalReferenceId(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;

  const canonical = raw
    .normalize('NFKC')
    .replace(DASH_VARIANTS, '-')
    // İş Bankası prints the reference as "07.10.2026/3835/4/13". Dots and
    // slashes are separators, folded so that spelling matches the dashed form.
    .replace(/[.\/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/\s+/g, '')
    .toUpperCase();

  return REFERENCE_ID_PATTERN.test(canonical) ? canonical : null;
}

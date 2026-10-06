// src/services/receiptTextParser.ts
/**
 * Turns raw OCR output into receipt fields.
 *
 * Kept free of native imports so it can be exercised without a device. It only
 * *extracts*: every value it returns is still checked by the adapter, and a
 * field it cannot find with reasonable confidence is left undefined for the
 * student to fill in rather than guessed.
 *
 * The on-device recogniser reads Latin script reliably but not Cyrillic, so
 * extraction leans on value shapes (digit runs, dates, reference formats) and
 * treats labels as a hint, with Latin, Russian, Kazakh and Turkish spellings.
 */
import { isCalendarDate } from './schemas';
import { canonicalReferenceId } from '../utils/referenceId';
import { localCalendarDate } from '../utils/dateUtils';

export interface OcrTextBlock {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
}

export interface OcrTextResult {
  text: string;
  blocks: OcrTextBlock[];
}

/** Values already bound to this device, used only to recognise them in the text. */
export interface ReceiptHints {
  fullName?: string;
  studentNumber?: string;
}

export interface ExtractedReceiptFields {
  studentName?: string;
  studentNumber?: string;
  paymentDate?: string;
  referenceId?: string;
}

// ── Labels ───────────────────────────────────────────────────────────────────

const DATE_LABELS = [
  'payment date', 'paid on', 'date', 'дата', 'күні', 'tarih', 'tarihi', 'оплачено',
];

const REFERENCE_LABELS = [
  'receipt', 'reference', 'ref', 'transaction', 'txn', 'operation', 'order',
  'check', 'invoice', 'document', 'чек', 'квитанция', 'квитанции', 'операция',
  'операции', 'транзакция', 'түбіртек', 'makbuz', 'işlem', 'islem', 'dekont',
  'fiş', 'fis', '№',
];

const STUDENT_NUMBER_LABELS = [
  'student id', 'student no', 'student number', 'student #', 'student',
  'студенческий', 'студента', 'студент', 'білім алушы', 'öğrenci no',
  'öğrenci numarası', 'ogrenci no',
];

const NAME_LABELS = [
  'student name', 'full name', 'payer', 'name', 'ф.и.о.', 'ф.и.о', 'фио',
  'плательщик', 'имя', 'аты-жөні', 'аты', 'ad soyad', 'adı soyadı', 'öğrenci adı',
];

/** Rows naming the merchant or staff rather than the student. */
const NOT_STUDENT_NAME = /(merchant|company|bank|store|shop|organi[sz]ation|cashier|operator|магазин|организац|компани|банк|кассир|mağaza|şirket|kasiyer)/i;

/** Words that sit between a label and its value: "Receipt No.: 123". */
const LABEL_QUALIFIER = /^[\s:#№.\-–]*(?:(?:no|nr|num|number|id|code|номер|n)(?![a-z])[\s.:#№-]*)?/i;

const isAsciiLetter = (char: string | undefined) => !!char && /[a-z]/i.test(char);

/**
 * Find the earliest label in a row. ASCII labels must stand alone so "name"
 * does not fire inside "username"; non-ASCII ones are matched as written.
 * Returns the index just past the label.
 */
function findLabelEnd(row: string, labels: readonly string[]): number | null {
  const lower = row.toLowerCase();
  let best: { start: number; end: number } | null = null;

  for (const label of labels) {
    let from = 0;
    while (from <= lower.length) {
      const start = lower.indexOf(label, from);
      if (start === -1) break;
      const end = start + label.length;
      const ascii = /^[\x20-\x7e]+$/.test(label);
      const standalone = !ascii || (!isAsciiLetter(lower[start - 1]) && !isAsciiLetter(lower[end]));
      if (standalone) {
        if (!best || start < best.start || (start === best.start && end > best.end)) {
          best = { start, end };
        }
        break;
      }
      from = start + 1;
    }
  }
  return best ? best.end : null;
}

/**
 * The text after a label, minus separators. Identifier labels also drop a
 * qualifier ("Receipt No.: 123"); a name never starts with one.
 */
function valueAfterLabel(
  row: string,
  labels: readonly string[],
  { identifier = true }: { identifier?: boolean } = {}
): string | null {
  const end = findLabelEnd(row, labels);
  if (end === null) return null;
  const rest = row.slice(end);
  return (identifier ? rest.replace(LABEL_QUALIFIER, '') : rest.replace(/^[\s:.\-–]+/, '')).trim();
}

// ── Layout ───────────────────────────────────────────────────────────────────

/**
 * Rebuild visual rows from positioned blocks.
 *
 * Receipts are often two columns (labels left, values right) and the
 * recogniser emits each column as its own block, so in plain reading order a
 * label and its value end up far apart. Each block's lines are placed at an
 * estimated height, then lines sharing a baseline are joined left to right.
 */
export function reconstructRows({ text, blocks }: OcrTextResult): string[] {
  const positioned = blocks.length > 0 && blocks.every((b) => b.boundingBox.height > 0);
  if (!positioned) {
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  interface Line { text: string; x: number; centerY: number; height: number }
  const lines: Line[] = [];
  for (const block of blocks) {
    const parts = block.text.split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const height = block.boundingBox.height / parts.length;
    parts.forEach((part, index) => {
      lines.push({
        text: part,
        x: block.boundingBox.x,
        centerY: block.boundingBox.y + height * (index + 0.5),
        height,
      });
    });
  }

  lines.sort((a, b) => a.centerY - b.centerY);

  const rows: Line[][] = [];
  for (const line of lines) {
    const current = rows[rows.length - 1];
    const anchor = current?.[0];
    if (anchor && Math.abs(line.centerY - anchor.centerY) < Math.min(line.height, anchor.height) * 0.5) {
      current.push(line);
    } else {
      rows.push([line]);
    }
  }

  return rows.map((row) =>
    row
      .sort((a, b) => a.x - b.x)
      .map((line) => line.text)
      .join('  ')
  );
}

// ── Dates ────────────────────────────────────────────────────────────────────

const ISO_DATE = /(?:^|\D)(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/g;
/** Day-first, as printed throughout the region this app serves. */
const DAY_FIRST_DATE = /(?:^|\D)(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)/g;

function toIsoDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  if (year < 2000 || year > 2099) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isCalendarDate(iso) ? iso : null;
}

function datesIn(row: string): string[] {
  const found: string[] = [];
  for (const match of row.matchAll(ISO_DATE)) {
    const iso = toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (iso) found.push(iso);
  }
  for (const match of row.matchAll(DAY_FIRST_DATE)) {
    const iso = toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));
    if (iso) found.push(iso);
  }
  return found;
}

/** Remove date-shaped text so its digits are not mistaken for an ID. */
function withoutDates(row: string): string {
  return row
    .replace(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/g, ' ')
    .replace(/\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2})/g, ' ');
}

function extractPaymentDate(rows: string[], today: string): string | undefined {
  const labelled: string[] = [];
  const other: string[] = [];

  rows.forEach((row, index) => {
    const dates = datesIn(row);
    if (findLabelEnd(row, DATE_LABELS) !== null) {
      // A label alone on its row is usually followed by the value.
      labelled.push(...(dates.length > 0 ? dates : datesIn(rows[index + 1] ?? '')));
    } else {
      other.push(...dates);
    }
  });

  const pool = labelled.length > 0 ? labelled : other;
  if (pool.length === 0) return undefined;

  // A payment cannot postdate the scan. If only future dates were read, return
  // one anyway so the adapter can refuse it with a specific reason.
  const past = pool.filter((date) => date <= today).sort();
  return past.length > 0 ? past[past.length - 1] : pool.sort()[0];
}

// ── Student number ───────────────────────────────────────────────────────────

const DIGIT_RUN = /(?:^|\D)(\d{6,12})(?!\d)/g;

function digitRunsIn(row: string): string[] {
  return [...withoutDates(row).matchAll(DIGIT_RUN)].map((match) => match[1]);
}

function extractStudentNumber(rows: string[], hints: ReceiptHints): string | undefined {
  for (let index = 0; index < rows.length; index++) {
    const value = valueAfterLabel(rows[index], STUDENT_NUMBER_LABELS);
    if (value === null) continue;
    const runs = digitRunsIn(value);
    if (runs.length > 0) return runs[0];
    // Only a label standing alone hands over to the next row; "Student Name:
    // Maxat" must not pick up whatever number is printed below it.
    if (!value) {
      const next = digitRunsIn(rows[index + 1] ?? '');
      if (next.length > 0) return next[0];
    }
  }

  // Unlabelled receipts: accept a number only if it is the one already bound.
  // Guessing among the other digit runs (phone, card, national ID) would
  // silently put the wrong student on the receipt.
  if (hints.studentNumber && rows.some((row) => digitRunsIn(row).includes(hints.studentNumber!))) {
    return hints.studentNumber;
  }
  return undefined;
}

// ── Reference ────────────────────────────────────────────────────────────────

/** A reference has a digit and enough length that a year or a time is not one. */
function plausibleReference(candidate: string | null): candidate is string {
  return !!candidate && /\d/.test(candidate) && candidate.replace(/-/g, '').length >= 6;
}

function referenceFromValue(value: string): string | null {
  const tokens = value.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // Long numbers are often printed in groups: "4829 1375 0042".
  let candidate = tokens[0];
  if (/^\d+$/.test(candidate)) {
    for (let i = 1; i < tokens.length && /^\d{2,6}$/.test(tokens[i]); i++) {
      candidate += tokens[i];
    }
  }

  const canonical = canonicalReferenceId(candidate);
  return plausibleReference(canonical) ? canonical : null;
}

/** Prefix-and-number shapes such as "RCP-482913" or "TXN00418827". */
const PREFIXED_REFERENCE = /(?:^|[^A-Z0-9])([A-Z]{2,6}[-\u2010-\u2015\u2212]?\d{5,20})(?![A-Z0-9])/;

function extractReferenceId(rows: string[], exclude: Set<string>): string | undefined {
  // Compared on digits so a legacy "STD23141035" cannot pass as the receipt.
  const usable = (candidate: string | null): candidate is string =>
    plausibleReference(candidate) && !exclude.has(candidate.replace(/\D/g, ''));

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const value = valueAfterLabel(row, REFERENCE_LABELS);
    if (value === null) continue;

    const inline = referenceFromValue(withoutDates(value));
    if (usable(inline)) return inline;

    if (!value) {
      const next = referenceFromValue(withoutDates(rows[index + 1] ?? ''));
      if (usable(next)) return next;
    }
  }

  for (const row of rows) {
    const match = PREFIXED_REFERENCE.exec(row.normalize('NFKC').toUpperCase());
    const candidate = match ? canonicalReferenceId(match[1]) : null;
    if (usable(candidate)) return candidate;
  }
  return undefined;
}

// ── Name ─────────────────────────────────────────────────────────────────────

const isLetter = (char: string) => char.toLowerCase() !== char.toUpperCase();

/** Letters, spaces and name punctuation only; one to five words. */
function plausibleName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;
  if ([...trimmed].filter(isLetter).length < 2) return false;
  if (![...trimmed].every((char) => isLetter(char) || " .'’-".includes(char))) return false;
  return trimmed.split(/\s+/).length <= 5;
}

const collapse = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').trim();

function extractStudentName(rows: string[], hints: ReceiptHints): string | undefined {
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (NOT_STUDENT_NAME.test(row)) continue;

    const value = valueAfterLabel(row, NAME_LABELS, { identifier: false });
    if (value === null) continue;

    // Two-column rows join with a double space; the name is the first cell.
    const cell = collapse(value.split(/\s{2,}/)[0] ?? '');
    if (plausibleName(cell)) return cell;

    if (!value) {
      const next = collapse((rows[index + 1] ?? '').split(/\s{2,}/)[0] ?? '');
      if (plausibleName(next)) return next;
    }
  }

  if (hints.fullName) {
    const wanted = collapse(hints.fullName).toLowerCase();
    const haystack = collapse(rows.join(' ')).toLowerCase();
    if (wanted && haystack.includes(wanted)) return collapse(hints.fullName);
  }
  return undefined;
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function extractReceiptFields(
  ocr: OcrTextResult,
  hints: ReceiptHints = {},
  now: Date = new Date()
): ExtractedReceiptFields {
  const rows = reconstructRows(ocr).map((row) => row.normalize('NFKC'));

  const studentNumber = extractStudentNumber(rows, hints);
  const paymentDate = extractPaymentDate(rows, localCalendarDate(now));

  // Never let the student number or a date double as the replay key.
  const exclude = new Set<string>();
  if (studentNumber) exclude.add(studentNumber);
  if (paymentDate) exclude.add(paymentDate.replace(/-/g, ''));
  const referenceId = extractReferenceId(rows, exclude);

  return {
    studentName: extractStudentName(rows, hints),
    studentNumber,
    paymentDate,
    referenceId,
  };
}

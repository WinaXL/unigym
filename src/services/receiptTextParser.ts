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
import { MAX_RECEIPT_AGE_DAYS } from '../core/constants';

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

/** Transaction date, ahead of "düzenleme tarihi" and other dates on the slip. */
const PAYMENT_DATE_LABELS = [
  'islem tarihi', 'payment date', 'paid on', 'оплачено',
];

const DATE_LABELS = [
  'payment date', 'paid on', 'date', 'дата', 'күні', 'tarih', 'tarihi', 'оплачено',
];

const REFERENCE_LABELS = [
  'receipt', 'reference', 'referans numarası', 'referans numarasi', 'referans',
  'ref', 'transaction', 'txn', 'operation', 'order',
  'check', 'invoice', 'document', 'belge no', 'чек', 'квитанция', 'квитанции',
  'операция', 'операции', 'транзакция', 'түбіртек', 'makbuz', 'fiş', 'fis', '№',
];

/** "Açıklama : 23141035 MAXAT KALIYEV" — the number and the student, one cell. */
const DESCRIPTION_LABELS = ['açıklama', 'aciklama'];
const NUMBER_AND_NAME = /(\d{6,12})\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*){0,3})/;

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

function toIsoDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  if (year < 2000 || year > 2099) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isCalendarDate(iso) ? iso : null;
}

/**
 * Digits ML Kit confuses on this dekont's print. The read digit maps to what
 * it might really have been. 0 is the usual victim: it comes back as 9 or 8
 * ("07.10.2026" → "97.19.2826").
 */
const DIGIT_ALTS: Record<string, readonly string[]> = {
  '0': ['0', '8', '9', '6'],
  '1': ['1', '7'],
  '2': ['2'],
  '3': ['3', '8'],
  '4': ['4'],
  '5': ['5', '6'],
  '6': ['6', '5', '0', '8'],
  '7': ['7', '1'],
  '8': ['8', '0', '3', '6', '9'],
  '9': ['9', '0', '8'],
};

const MAX_DIGIT_CORRECTIONS = 4;

function foldTr(value: string): string {
  return value
    .toLowerCase()
    .replace(/\u0307/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function hasFoldedLabel(row: string, labels: readonly string[]): boolean {
  const folded = foldTr(row);
  return labels.some((label) => {
    const needle = foldTr(label);
    const start = folded.indexOf(needle);
    if (start < 0) return false;
    const before = folded[start - 1];
    const after = folded[start + needle.length];
    const letter = (char?: string) => !!char && char >= 'a' && char <= 'z';
    return !letter(before) && !letter(after);
  });
}

function calendarDaysBefore(laterIso: string, earlierIso: string): number {
  const utc = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(laterIso) - utc(earlierIso)) / 86_400_000);
}

/** How many digits differ, or null when a difference is not a known confusion. */
function confusionDistance(read: string, actual: string): number | null {
  if (read.length !== actual.length) return null;
  let changes = 0;
  for (let i = 0; i < read.length; i++) {
    if (read[i] === actual[i]) continue;
    if (!(DIGIT_ALTS[read[i]] ?? [read[i]]).includes(actual[i])) return null;
    changes++;
  }
  return changes;
}

/**
 * Turn an 8-digit day-month-year, possibly misread, into a real payment date
 * inside the freshness window. The reading with the fewest changed digits wins.
 */
function recoverDayFirstDigits(
  digits: string,
  today: string
): { iso: string; changes: number } | null {
  if (!/^\d{8}$/.test(digits)) return null;

  let best: { iso: string; changes: number } | null = null;
  const alts = digits.split('').map((digit) => DIGIT_ALTS[digit] ?? [digit]);

  function visit(pos: number, built: string, changes: number) {
    if (changes > MAX_DIGIT_CORRECTIONS) return;
    if (best && changes > best.changes) return;
    if (pos === digits.length) {
      const iso = toIsoDate(
        Number(built.slice(4, 8)),
        Number(built.slice(2, 4)),
        Number(built.slice(0, 2))
      );
      if (!iso || iso > today) return;
      if (calendarDaysBefore(today, iso) > MAX_RECEIPT_AGE_DAYS) return;
      if (!best || changes < best.changes || (changes === best.changes && iso > best.iso)) {
        best = { iso, changes };
      }
      return;
    }
    const seen = new Set<string>();
    for (const alt of alts[pos]) {
      if (seen.has(alt)) continue;
      seen.add(alt);
      visit(pos + 1, built + alt, changes + (alt === digits[pos] ? 0 : 1));
    }
  }

  visit(0, '', 0);
  return best;
}

/** Day-first dates on a row, repaired when OCR damaged the digits. */
function recoveredDatesIn(row: string, today: string): { iso: string; changes: number }[] {
  const found: { iso: string; changes: number }[] = [];
  const shape = /(?:^|\D)(\d{2})[./-](\d{2})[./-](\d{4})(?!\d)/g;
  for (const match of row.matchAll(shape)) {
    const recovered = recoverDayFirstDigits(match[1] + match[2] + match[3], today);
    if (recovered) found.push(recovered);
  }
  return found;
}

/** Remove date-shaped text so its digits are not mistaken for an ID. */
function withoutDates(row: string): string {
  return row
    .replace(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/g, ' ')
    .replace(/\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2})/g, ' ');
}

function datesBesideLabel(
  rows: string[],
  labels: readonly string[],
  today: string
): { iso: string; changes: number }[] {
  const found: { iso: string; changes: number }[] = [];
  rows.forEach((row, index) => {
    if (!hasFoldedLabel(row, labels) && findLabelEnd(row, labels) === null) return;
    const onRow = recoveredDatesIn(row, today);
    found.push(...(onRow.length > 0 ? onRow : recoveredDatesIn(rows[index + 1] ?? '', today)));
  });
  return found;
}

/** Fewest OCR corrections, then the latest date still inside the window. */
function bestRecovered(dates: { iso: string; changes: number }[]): string | undefined {
  if (dates.length === 0) return undefined;
  return dates.reduce((best, date) =>
    date.changes < best.changes || (date.changes === best.changes && date.iso > best.iso)
      ? date
      : best
  ).iso;
}

function extractPaymentDate(rows: string[], today: string): string | undefined {
  const transaction = bestRecovered(datesBesideLabel(rows, PAYMENT_DATE_LABELS, today));
  if (transaction) return transaction;

  const labelled = bestRecovered(datesBesideLabel(rows, DATE_LABELS, today));
  if (labelled) return labelled;

  return bestRecovered(rows.flatMap((row) => recoveredDatesIn(row, today)));
}

// ── Student number ───────────────────────────────────────────────────────────

const DIGIT_RUN = /(?:^|\D)(\d{6,12})(?!\d)/g;

function digitRunsIn(row: string): string[] {
  return [...withoutDates(row).matchAll(DIGIT_RUN)].map((match) => match[1]);
}

interface BankReferenceMatch {
  /** DDMMYYYY as OCR read it. */
  prefix: string;
  tail: string;
}

function bankReferenceMatches(rows: string[]): BankReferenceMatch[] {
  const matches: BankReferenceMatch[] = [];
  const pattern = /(\d{2})[./-](\d{2})[./-](\d{4})\/(\d{2,6})\/(\d{1,4})\/(\d{1,4})(?!\d)/g;
  for (const row of rows) {
    const compact = row.replace(/\s+/g, '');
    for (const match of compact.matchAll(pattern)) {
      matches.push({
        prefix: match[1] + match[2] + match[3],
        tail: `${match[4]}-${match[5]}-${match[6]}`,
      });
    }
  }
  return matches;
}

/**
 * Pick the İş Bankası reference. The date prefix is repaired from the payment
 * date when OCR confused it ("97.19.2826" → "07.10.2026"). The sequence after
 * the slashes is kept as read. When two passes disagree, the reading whose
 * date needed fewer corrections wins — that is the clearer image.
 */
function bestBankReference(
  rows: string[],
  today: string,
  paymentDate: string | undefined,
  exclude: Set<string>
): string | undefined {
  const target = paymentDate
    ? `${paymentDate.slice(8, 10)}${paymentDate.slice(5, 7)}${paymentDate.slice(0, 4)}`
    : null;

  let best: { id: string; changes: number } | null = null;
  for (const match of bankReferenceMatches(rows)) {
    let changes: number | null = null;
    let iso = paymentDate ?? null;

    if (target) {
      const distance = confusionDistance(match.prefix, target);
      if (distance !== null && distance <= MAX_DIGIT_CORRECTIONS) changes = distance;
    }
    if (changes === null) {
      const recovered = recoverDayFirstDigits(match.prefix, today);
      if (!recovered) continue;
      changes = recovered.changes;
      iso = recovered.iso;
    }
    if (!iso) continue;

    const day = iso.slice(8, 10);
    const month = iso.slice(5, 7);
    const year = iso.slice(0, 4);
    const id = canonicalReferenceId(`${day}-${month}-${year}-${match.tail}`);
    if (!plausibleReference(id) || exclude.has(id.replace(/\D/g, ''))) continue;
    if (!best || changes < best.changes) best = { id, changes };
  }
  return best?.id;
}

/**
 * Identity written in the dekont's Açıklama cell. Prefer a labelled row; fall
 * back to the same "number then name" shape so a misread label still works.
 * Other digit runs on the slip (customer number, VKN, IBAN groups) have no name
 * beside them, so they are not taken as the student number.
 */
function extractDescribedStudent(rows: string[]): { studentNumber?: string; studentName?: string } {
  const labelled = rows
    .map((row) => valueAfterLabel(row, DESCRIPTION_LABELS, { identifier: false }))
    .filter((value): value is string => !!value);
  const candidates = labelled.length > 0 ? labelled : rows;

  for (const value of candidates) {
    const match = NUMBER_AND_NAME.exec(collapse(value));
    if (!match || !plausibleName(match[2])) continue;
    return { studentNumber: match[1], studentName: collapse(match[2]) };
  }
  return {};
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

function extractReferenceId(
  rows: string[],
  exclude: Set<string>,
  today: string,
  paymentDate: string | undefined
): string | undefined {
  // Compared on digits so a legacy "STD23141035" cannot pass as the receipt.
  const usable = (candidate: string | null): candidate is string =>
    plausibleReference(candidate) && !exclude.has(candidate.replace(/\D/g, ''));

  const bank = bestBankReference(rows, today, paymentDate, exclude);
  if (bank) return bank;

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

  const today = localCalendarDate(now);
  const described = extractDescribedStudent(rows);
  const studentNumber = described.studentNumber ?? extractStudentNumber(rows, hints);
  let paymentDate = extractPaymentDate(rows, today);

  // Never let the student number or a date double as the replay key.
  const exclude = new Set<string>();
  if (studentNumber) exclude.add(studentNumber);
  if (paymentDate) exclude.add(paymentDate.replace(/-/g, ''));
  const referenceId = extractReferenceId(rows, exclude, today, paymentDate);

  // The reference starts with the payment date. Use it when the "İşlem Tarihi"
  // line itself was not readable.
  if (!paymentDate && referenceId) {
    const prefix = /^(\d{2})-(\d{2})-(\d{4})-/.exec(referenceId);
    if (prefix) {
      const iso = `${prefix[3]}-${prefix[2]}-${prefix[1]}`;
      if (isCalendarDate(iso)) paymentDate = iso;
    }
  }

  return {
    studentName: described.studentName ?? extractStudentName(rows, hints),
    studentNumber,
    paymentDate,
    referenceId,
  };
}

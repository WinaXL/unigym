/** Pure, conservative extraction from the university's İş Bankası receipts. */
import { isCalendarDate } from './schemas';
import type { ReceiptData } from '../types/api';

export interface OcrTextBlock {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
}

export interface OcrTextResult {
  text: string;
  blocks: OcrTextBlock[];
}

/** Rejoin labels and values emitted as separate OCR columns. */
export function reconstructRows({ text, blocks }: OcrTextResult): string[] {
  const positioned = blocks.length > 0 && blocks.every((block) => block.boundingBox.height > 0);
  if (!positioned) return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  interface Line { text: string; x: number; centerY: number; height: number }
  const lines: Line[] = [];
  for (const block of blocks) {
    const parts = block.text.split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
    const height = block.boundingBox.height / parts.length;
    parts.forEach((part, index) => lines.push({
      text: part,
      x: block.boundingBox.x,
      centerY: block.boundingBox.y + height * (index + 0.5),
      height,
    }));
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
  return rows.map((row) => row.sort((a, b) => a.x - b.x).map((line) => line.text).join('  '));
}

function foldLabel(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/ı/g, 'i').toLowerCase();
}

function afterLabel(row: string, label: RegExp): string | null {
  const match = label.exec(foldLabel(row));
  return match ? row.slice(match.index + match[0].length).replace(/^[\s:：.\-–]+/, '').trim() : null;
}

const DESCRIPTION = /\baciklama\b/;
const PAYMENT_DATE = /\b(?:islem tarihi|payment date|paid on)\b/;
// A header accidentally joined to a numeric cell must never become a person.
const RECEIPT_WORDS = /\b(?:duzenleme|duzenlene|tarihi?|musteri|numarasi|referans|belge|banka|bankasi|islem|iban|vkn|tutar|aciklama|dekont|turkiye|universitesi|customer|payment|date|receipt|student|number|name)\b/;
const IDENTITY = /^(\d{8})(?!\d)\s+([\p{Script=Latin}\p{M}][\p{Script=Latin}\p{M}'’.-]*(?:\s+[\p{Script=Latin}\p{M}][\p{Script=Latin}\p{M}'’.-]*){1,5})\s*$/u;

function describedIdentity(rows: string[]): { studentNumber: string; studentName: string }[] {
  const found: { studentNumber: string; studentName: string }[] = [];
  rows.forEach((row, index) => {
    const value = afterLabel(row, DESCRIPTION);
    if (value === null) return;
    // Only a bare label hands over to an adjacent value. Never search the page
    // for a number/name or use the saved profile to fill an unreadable cell.
    let cell = value || (rows[index + 1] ?? '').replace(/^[\s:：]+/, '');
    if (/^\d{8}$/.test(cell)) cell += ` ${rows[index + (value ? 1 : 2)] ?? ''}`;
    const match = IDENTITY.exec(cell);
    if (!match || RECEIPT_WORDS.test(foldLabel(match[2]))) return;
    found.push({ studentNumber: match[1], studentName: match[2].replace(/\s+/g, ' ').trim() });
  });
  return found;
}

function datesIn(value: string): string[] {
  const dates: string[] = [];
  for (const match of value.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) {
    const iso = `${match[1]}-${match[2]}-${match[3]}`;
    if (isCalendarDate(iso)) dates.push(iso);
  }
  for (const match of value.matchAll(/(?<!\d)(\d{2})[./-](\d{2})[./-](\d{4})(?!\d)/g)) {
    const iso = `${match[3]}-${match[2]}-${match[1]}`;
    if (isCalendarDate(iso)) dates.push(iso);
  }
  return dates;
}

function paymentDates(rows: string[]): string[] {
  return rows.flatMap((row, index) => {
    const value = afterLabel(row, PAYMENT_DATE);
    // No print-date or reference-date fallback. Impossible digits stay blank;
    // guessing against today's date would silently rewrite older payments.
    if (value === null) return [];
    const cell = value || (rows[index + 1] ?? '').replace(/^[\s:：]+/, '');
    return /^\d/.test(cell) ? datesIn(cell) : [];
  });
}

/** Conflicting OCR readings are left for the student's manual review. */
export function extractReceiptFields(result: OcrTextResult): ReceiptData {
  const clean = (rows: string[]) => rows.map((row) => row.normalize('NFKC').trim()).filter(Boolean);
  const sources = [clean(reconstructRows(result)), clean(result.text.split(/\r?\n/))];
  const identities = sources.flatMap(describedIdentity);
  const uniqueIdentities = new Map(identities.map((identity) => [
    `${identity.studentNumber}:${identity.studentName.toUpperCase()}`, identity,
  ]));
  const dates = new Set(sources.flatMap(paymentDates));
  return {
    ...(uniqueIdentities.size === 1 ? [...uniqueIdentities.values()][0] : {}),
    ...(dates.size === 1 ? { paymentDate: [...dates][0] } : {}),
  };
}

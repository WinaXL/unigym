// src/services/receiptParser.ts
/**
 * Receipt field extraction.
 *
 * There is no OCR here yet. The previous version of this file claimed to do
 * text recognition but ignored the image entirely and returned a fabricated
 * receipt with an always-valid payment date and a random reference ID, which
 * meant a photograph of anything at all granted a membership.
 *
 * Until on-device OCR lands, extraction is explicitly a *simulation* and it is
 * confined to development builds. A release build throws OcrUnavailableError so
 * the scan path cannot silently manufacture a valid receipt.
 */
import type { ReceiptData } from '../types/api';

/** Flip to true once a real text recogniser backs `parseReceiptImage`. */
export const OCR_AVAILABLE = false;

export class OcrUnavailableError extends Error {
  constructor() {
    super('Receipt text recognition is not available in this build');
    this.name = 'OcrUnavailableError';
  }
}

export interface ParsedReceipt extends ReceiptData {
  /** True when the fields were simulated rather than read from the image. */
  simulated: boolean;
}

/** Identity used to seed a simulated receipt so renewals can be exercised. */
export interface SimulationSeed {
  fullName?: string;
  studentNumber?: string;
}

/** FNV-1a, so the same image yields the same reference every time. */
function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Extract receipt fields from a captured image.
 *
 * The reference ID is derived from the image URI rather than randomised, so
 * re-submitting the same image reproduces the same reference and the
 * spent-receipt ledger actually rejects it — the old random ID made duplicate
 * detection impossible to trigger, and therefore impossible to trust.
 *
 * @throws OcrUnavailableError in release builds.
 */
export async function parseReceiptImage(
  imageUri: string,
  seed: SimulationSeed = {}
): Promise<ParsedReceipt> {
  if (!OCR_AVAILABLE && !__DEV__) {
    throw new OcrUnavailableError();
  }

  await new Promise<void>((resolve) => setTimeout(resolve, 900));

  const reference = `RCP-${(stableHash(imageUri) % 900000) + 100000}`;
  const paidOn = new Date();
  paidOn.setDate(paidOn.getDate() - 1);

  return {
    studentName: seed.fullName?.trim() || '',
    studentNumber: seed.studentNumber?.trim() || '',
    paymentDate: isoDate(paidOn),
    referenceId: reference,
    amount: '15,000 KZT',
    planType: 'Monthly Gym Unlimited',
    simulated: true,
  };
}

// src/services/receiptParser.ts
/**
 * Receipt field extraction backed by on-device OCR (expo-ocr-kit: ML Kit on
 * Android, Vision on iOS).
 *
 * Nothing here is simulated. When text cannot be recognised, or the receipt's
 * reference cannot be found, this throws: the reference is the key that stops
 * a receipt being redeemed twice, so a scan without one must not proceed.
 */
import { requireOptionalNativeModule } from 'expo';
import type { OcrResult } from 'expo-ocr-kit';

import type { ReceiptData } from '../types/api';
import { extractReceiptFields, type ReceiptHints } from './receiptTextParser';

export type { ReceiptHints } from './receiptTextParser';

export type ReceiptScanErrorCode =
  /** The native recogniser is not in this binary (Expo Go, web). */
  | 'OCR_UNAVAILABLE'
  /** The image could not be decoded or recognition failed or timed out. */
  | 'UNREADABLE_IMAGE'
  /** Recognition ran but found no text. */
  | 'NO_TEXT'
  /** Text was found but no receipt reference could be identified in it. */
  | 'NO_REFERENCE';

export class ReceiptScanError extends Error {
  constructor(readonly code: ReceiptScanErrorCode, options?: { cause?: unknown }) {
    super(`Receipt scan failed: ${code}`, options);
    this.name = 'ReceiptScanError';
  }
}

interface OcrNativeModule {
  recognizeText(uri: string): Promise<OcrResult>;
}

/**
 * Looked up directly rather than through the package entry point, which also
 * registers an unrelated native view. Null when the binary lacks the module.
 */
const ocrModule = requireOptionalNativeModule<OcrNativeModule>('ExpoOcrKit');

export const OCR_AVAILABLE = ocrModule !== null;

/** Recognition normally takes well under a second; a stall must not hang the UI. */
const OCR_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('OCR timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Read receipt fields from a local image (file:// or content:// URI).
 *
 * Name, student number and date may come back undefined when they cannot be
 * read with confidence; the student fills those in and the adapter validates
 * them. The reference is always present on success.
 *
 * @param hints Identity already bound to this device. Used only to recognise
 *   those values in the text — never to fill a field the image does not show.
 * @throws ReceiptScanError
 */
export async function parseReceiptImage(
  imageUri: string,
  hints: ReceiptHints = {}
): Promise<ReceiptData> {
  if (!ocrModule) throw new ReceiptScanError('OCR_UNAVAILABLE');

  let result: OcrResult;
  try {
    result = await withTimeout(ocrModule.recognizeText(imageUri), OCR_TIMEOUT_MS);
  } catch (error) {
    throw new ReceiptScanError('UNREADABLE_IMAGE', { cause: error });
  }

  if (!result || typeof result.text !== 'string' || !result.text.trim()) {
    throw new ReceiptScanError('NO_TEXT');
  }

  const fields = extractReceiptFields(
    { text: result.text, blocks: Array.isArray(result.blocks) ? result.blocks : [] },
    hints
  );

  if (!fields.referenceId) throw new ReceiptScanError('NO_REFERENCE');

  return fields;
}

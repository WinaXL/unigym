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
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { ReceiptData } from '../types/api';
import { extractReceiptFields, type OcrTextBlock, type ReceiptHints } from './receiptTextParser';

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
 * The reference sits in the right-hand column of an İş Bankası dekont. Cropping
 * to that column feeds ML Kit larger digits, so 0/8/9 confusions are less likely.
 * Returns null when the image cannot be measured or cropped.
 */
async function cropReferenceColumn(uri: string): Promise<string | null> {
  let context: ReturnType<typeof ImageManipulator.manipulate> | null = null;
  let image: Awaited<ReturnType<ReturnType<typeof ImageManipulator.manipulate>['renderAsync']>> | null = null;
  try {
    context = ImageManipulator.manipulate(uri);
    image = await context.renderAsync();
    const { width, height } = image;
    image.release();
    image = null;
    context.release();
    context = null;

    const originX = Math.round(width * 0.38);
    const cropWidth = width - originX;
    if (cropWidth < 64 || height < 64) return null;

    context = ImageManipulator.manipulate(uri);
    context.crop({ originX, originY: 0, width: cropWidth, height });
    image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: 1, format: SaveFormat.JPEG });
    return saved.uri;
  } catch {
    return null;
  } finally {
    image?.release();
    context?.release();
  }
}

function blocksOf(result: OcrResult | null): OcrTextBlock[] {
  if (!result || !Array.isArray(result.blocks)) return [];
  return result.blocks.filter(
    (block) => block && typeof block.text === 'string' && block.boundingBox
  );
}

/**
 * Read receipt fields from a local image (file:// or content:// URI).
 *
 * The whole slip is read first, then the reference column on its own. Both
 * readings are kept: a clearer column reading replaces a scrambled full-page
 * reference when its date needed fewer digit corrections.
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

  const deadline = Date.now() + OCR_TIMEOUT_MS;
  const recognize = (uri: string) => {
    const remaining = deadline - Date.now();
    if (remaining < 1_000) return Promise.reject(new Error('OCR timed out'));
    return withTimeout(ocrModule.recognizeText(uri), remaining);
  };

  let full: OcrResult;
  try {
    full = await recognize(imageUri);
  } catch (error) {
    throw new ReceiptScanError('UNREADABLE_IMAGE', { cause: error });
  }

  const columnUri = await cropReferenceColumn(imageUri);
  let column: OcrResult | null = null;
  if (columnUri) {
    try {
      column = await recognize(columnUri);
    } catch {
      column = null;
    }
  }

  const fullBlocks = blocksOf(full);
  const columnText = column?.text?.trim() ?? '';
  const blocks = [...fullBlocks];
  if (columnText && fullBlocks.length > 0) {
    // Above the full-page blocks, so a tie keeps this closer reading of the digits.
    columnText.split(/\r?\n/).filter(Boolean).forEach((line, index) => {
      blocks.push({
        text: line,
        boundingBox: { x: 0, y: -100000 + index * 48, width: 20, height: 36 },
      });
    });
  }

  const text = [columnText, full.text].filter((part) => part && part.trim()).join('\n');
  if (!text.trim()) throw new ReceiptScanError('NO_TEXT');

  const fields = extractReceiptFields(
    { text, blocks: blocks.length > 0 ? blocks : [] },
    hints
  );

  if (!fields.referenceId) throw new ReceiptScanError('NO_REFERENCE');

  return fields;
}

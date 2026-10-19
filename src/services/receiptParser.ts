// src/services/receiptParser.ts
/**
 * Receipt field extraction backed by on-device OCR (expo-ocr-kit: ML Kit on
 * Android, Vision on iOS).
 *
 * Nothing here is simulated. Recognition is a best-effort aid to the editable
 * review form; adapter validation still decides whether the payment qualifies.
 */
import { requireOptionalNativeModule } from 'expo';
import type { OcrResult } from 'expo-ocr-kit';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';

import type { ReceiptData } from '../types/api';
import { extractReceiptFields, type OcrTextBlock } from './receiptTextParser';
import { findPaperFrame } from './paperFrame';

export type ReceiptScanErrorCode =
  /** The native recogniser is not in this binary (Expo Go, web). */
  | 'OCR_UNAVAILABLE'
  /** The image could not be decoded or recognition failed or timed out. */
  | 'UNREADABLE_IMAGE'
  /** Recognition ran but found no text. */
  | 'NO_TEXT'
  /** Text was found but one or more required details could not be read. */
  | 'INCOMPLETE_DETAILS';

export interface ReceiptScanResult {
  receipt: ReceiptData;
  issue: ReceiptScanErrorCode | null;
  diagnostics: {
    nativeAvailable: boolean;
    attemptedPasses: number;
    failedPasses: number;
    recognizedCharacters: number;
  };
}

interface OcrNativeModule {
  recognizeText(uri: string): Promise<OcrResult>;
}

/**
 * Looked up directly rather than through the package entry point, which also
 * registers an unrelated native view. Null when the binary lacks the module.
 */
const ocrModule = requireOptionalNativeModule<OcrNativeModule>('ExpoOcrKit');

export const OCR_AVAILABLE = typeof ocrModule?.recognizeText === 'function';

/** Full page plus a column pass, after an optional crop. */
const OCR_TIMEOUT_MS = 35_000;

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

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type Manipulator = ReturnType<typeof ImageManipulator.manipulate>;
type RenderedImage = Awaited<ReturnType<Manipulator['renderAsync']>>;

function releaseQuietly(resource: { release?: () => void } | null) {
  try {
    resource?.release?.();
  } catch {
    // Already released.
  }
}

/**
 * Crop away the black border around a receipt photographed on a screen, then
 * enlarge it so the receipt text is large enough to read. Returns the
 * original URI when the paper already fills the photo or the crop fails.
 */
async function focusOnPaper(uri: string): Promise<string> {
  let context: Manipulator | null = null;
  let image: RenderedImage | null = null;
  try {
    context = ImageManipulator.manipulate(uri);
    image = await context.renderAsync();
    const originalWidth = image.width;
    const originalHeight = image.height;
    releaseQuietly(image);
    image = null;
    releaseQuietly(context);
    context = null;
    if (originalWidth < 32 || originalHeight < 32) return uri;

    context = ImageManipulator.manipulate(uri);
    // Bound the long edge, including very tall screenshots.
    context.resize(originalWidth >= originalHeight ? { width: 800 } : { height: 800 });
    image = await context.renderAsync();
    const preview = await image.saveAsync({
      compress: 0.6,
      format: SaveFormat.JPEG,
      base64: true,
    });
    releaseQuietly(image);
    image = null;
    releaseQuietly(context);
    context = null;
    if (!preview.base64) return uri;

    const decoded = decodeJpeg(base64ToBytes(preview.base64), {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 1,
    });
    const frame = findPaperFrame(decoded.data, decoded.width, decoded.height);
    if (!frame) return uri;

    const scale = originalWidth / decoded.width;
    const originX = Math.max(0, Math.round(frame.x * scale));
    const originY = Math.max(0, Math.round(frame.y * scale));
    const cropWidth = Math.min(originalWidth - originX, Math.round(frame.width * scale));
    const cropHeight = Math.min(originalHeight - originY, Math.round(frame.height * scale));
    if (cropWidth < 64 || cropHeight < 64) return uri;

    context = ImageManipulator.manipulate(uri);
    context.crop({ originX, originY, width: cropWidth, height: cropHeight });
    const longSide = Math.max(cropWidth, cropHeight);
    if (longSide < 1500) {
      context.resize({ width: Math.round((cropWidth * 1800) / longSide) });
    }
    image = await context.renderAsync();
    const focused = await image.saveAsync({ compress: 0.95, format: SaveFormat.JPEG });
    return focused.uri || uri;
  } catch {
    return uri;
  } finally {
    releaseQuietly(image);
    releaseQuietly(context);
  }
}

/**
 * The payment date sits in the right-hand column of an İş Bankası dekont. Cropping
 * to that column feeds ML Kit larger digits, so 0/8/9 confusions are less likely.
 * Returns null when the image cannot be measured or cropped.
 */
async function cropPaymentColumn(uri: string): Promise<string | null> {
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
 * The whole slip is read first, then the payment-date column on its own.
 * Each pass is parsed separately to avoid joining unrelated lines across crops.
 *
 * Name, student number and date may come back undefined when they cannot be
 * read with confidence; the student fills those in and the adapter validates
 * them. Missing details or an unavailable OCR engine return a review notice,
 * preserving all fields that were read so the user can complete them manually.
 *
 */
export async function parseReceiptImage(imageUri: string): Promise<ReceiptScanResult> {
  const diagnostics: ReceiptScanResult['diagnostics'] = {
    nativeAvailable: OCR_AVAILABLE, attemptedPasses: 0, failedPasses: 0, recognizedCharacters: 0,
  };
  const finish = (receipt: ReceiptData, issue: ReceiptScanErrorCode | null): ReceiptScanResult => {
    // Counts and status only: never log receipt text, names or URIs.
    console.info('[ReceiptOCR]', JSON.stringify({ ...diagnostics, issue }));
    return { receipt, issue, diagnostics };
  };
  if (!ocrModule || !OCR_AVAILABLE) return finish({}, 'OCR_UNAVAILABLE');

  const sourceUri = await focusOnPaper(imageUri);

  const deadline = Date.now() + OCR_TIMEOUT_MS;
  const recognize = (uri: string) => {
    diagnostics.attemptedPasses++;
    const remaining = deadline - Date.now();
    if (remaining < 1_000) return Promise.reject(new Error('OCR timed out'));
    return withTimeout(ocrModule.recognizeText(uri), remaining);
  };

  let full: OcrResult | null = null;
  try {
    full = await recognize(sourceUri);
  } catch {
    diagnostics.failedPasses++;
  }

  const columnUri = await cropPaymentColumn(sourceUri);
  let column: OcrResult | null = null;
  if (columnUri) {
    try {
      column = await recognize(columnUri);
    } catch {
      diagnostics.failedPasses++;
    }
  }

  const text = [column?.text, full?.text].filter((part) => typeof part === 'string' && part.trim()).join('\n');
  diagnostics.recognizedCharacters = text.length;
  if (!text.trim()) return finish({}, diagnostics.failedPasses === diagnostics.attemptedPasses ? 'UNREADABLE_IMAGE' : 'NO_TEXT');

  const readings = [full, column].filter((result): result is OcrResult => result !== null)
    .map((result) => extractReceiptFields({ text: result.text ?? '', blocks: blocksOf(result) }));
  const fields: ReceiptData = {};
  for (const key of ['studentName', 'studentNumber', 'paymentDate'] as const) {
    const values = [...new Set(readings.map((reading) => reading[key]).filter((value): value is string => !!value))];
    if (values.length === 1) fields[key] = values[0];
  }
  // Identity is one Açıklama cell: never combine halves from different passes.
  if (!fields.studentName || !fields.studentNumber) {
    delete fields.studentName;
    delete fields.studentNumber;
  }
  return finish(fields, fields.studentName && fields.studentNumber && fields.paymentDate ? null : 'INCOMPLETE_DETAILS');
}

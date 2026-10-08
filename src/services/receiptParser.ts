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
import { decode as decodeJpeg } from 'jpeg-js';

import type { ReceiptData } from '../types/api';
import { extractReceiptFields, type OcrTextBlock, type ReceiptHints } from './receiptTextParser';
import { findPaperFrame } from './paperFrame';

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
 * enlarge it so the reference digits are large enough to read. Returns the
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
    context.resize({ width: 480 });
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
      maxResolutionInMP: 2,
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

  const sourceUri = await focusOnPaper(imageUri);

  const deadline = Date.now() + OCR_TIMEOUT_MS;
  const recognize = (uri: string) => {
    const remaining = deadline - Date.now();
    if (remaining < 1_000) return Promise.reject(new Error('OCR timed out'));
    return withTimeout(ocrModule.recognizeText(uri), remaining);
  };

  let full: OcrResult;
  try {
    full = await recognize(sourceUri);
  } catch (error) {
    throw new ReceiptScanError('UNREADABLE_IMAGE', { cause: error });
  }

  const columnUri = await cropReferenceColumn(sourceUri);
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

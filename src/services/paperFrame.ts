// src/services/paperFrame.ts
/**
 * Finds the pale paper rectangle inside a photo.
 *
 * Gallery shots of a receipt on a monitor are mostly black, with the slip as a
 * small bright band. OCR then sees tiny type and misses the reference. A photo
 * where the paper already fills the frame returns null so we leave those
 * pixels alone.
 */

export interface PaperFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PAPER_LUMA = 150;
const SAMPLE = 2;

function firstHit(counts: Uint32Array, need: number): number {
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] >= need) return i;
  }
  return -1;
}

function lastHit(counts: Uint32Array, need: number): number {
  for (let i = counts.length - 1; i >= 0; i--) {
    if (counts[i] >= need) return i;
  }
  return -1;
}

/**
 * @param rgba RGBA bytes, row-major, 4 bytes per pixel.
 */
export function findPaperFrame(
  rgba: Uint8Array,
  width: number,
  height: number
): PaperFrame | null {
  if (width < 16 || height < 16) return null;
  if (rgba.length < width * height * 4) return null;

  const rowHits = new Uint32Array(height);
  const colHits = new Uint32Array(width);
  let samplesPerRow = 0;

  for (let y = 0; y < height; y += SAMPLE) {
    samplesPerRow = 0;
    for (let x = 0; x < width; x += SAMPLE) {
      samplesPerRow++;
      const i = (y * width + x) * 4;
      // Integer luma. Paper is near white; a monitor bezel and letterbox are not.
      const luma = (rgba[i] * 54 + rgba[i + 1] * 183 + rgba[i + 2] * 19) >> 8;
      if (luma >= PAPER_LUMA) {
        rowHits[y]++;
        colHits[x]++;
      }
    }
  }

  let samplesPerCol = 0;
  for (let y = 0; y < height; y += SAMPLE) samplesPerCol++;

  const rowNeed = Math.max(3, Math.floor(samplesPerRow * 0.2));
  const colNeed = Math.max(3, Math.floor(samplesPerCol * 0.08));

  const top = firstHit(rowHits, rowNeed);
  const bottom = lastHit(rowHits, rowNeed);
  const left = firstHit(colHits, colNeed);
  const right = lastHit(colHits, colNeed);
  if (top < 0 || left < 0 || bottom - top < 8 || right - left < 8) return null;

  const padX = Math.round((right - left) * 0.03);
  const padY = Math.round((bottom - top) * 0.08);
  const x = Math.max(0, left - padX);
  const y = Math.max(0, top - padY);
  const maxX = Math.min(width - 1, right + padX);
  const maxY = Math.min(height - 1, bottom + padY);
  const frame = { x, y, width: maxX - x + 1, height: maxY - y + 1 };

  const coverage = (frame.width * frame.height) / (width * height);
  // Already fills the photo: cropping would only recompress a good scan.
  if (coverage > 0.9) return null;
  if (frame.width < width * 0.25 || frame.height < height * 0.06) return null;
  return frame;
}

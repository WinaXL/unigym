/** Find the largest connected pale paper region, excluding screen chrome. */
export interface PaperFrame { x: number; y: number; width: number; height: number }

export function findPaperFrame(rgba: Uint8Array, width: number, height: number): PaperFrame | null {
  if (width < 16 || height < 16 || rgba.length < width * height * 4) return null;
  const sample = 2;
  const cols = Math.ceil(width / sample);
  const rows = Math.ceil(height / sample);
  const bright = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * sample * width + x * sample) * 4;
      const luma = (rgba[i] * 54 + rgba[i + 1] * 183 + rgba[i + 2] * 19) >> 8;
      const spread = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) - Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
      bright[y * cols + x] = luma >= 140 && spread < 65 ? 1 : 0;
    }
  }
  const queue = new Int32Array(bright.length);
  let best: { left: number; right: number; top: number; bottom: number; area: number } | null = null;
  for (let start = 0; start < bright.length; start++) {
    if (!bright[start]) continue;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    bright[start] = 0;
    let left = cols, right = 0, top = rows, bottom = 0;
    while (head < tail) {
      const index = queue[head++];
      const x = index % cols;
      const y = Math.floor(index / cols);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      const neighbours = [x > 0 ? index - 1 : -1, x < cols - 1 ? index + 1 : -1,
        y > 0 ? index - cols : -1, y < rows - 1 ? index + cols : -1];
      for (const next of neighbours) {
        if (next >= 0 && bright[next]) { bright[next] = 0; queue[tail++] = next; }
      }
    }
    const boxArea = (right - left + 1) * (bottom - top + 1);
    // Relative-to-image-height thresholds used to reject short receipt bands.
    if ((right - left + 1) * sample < width * 0.25 || (bottom - top + 1) * sample < 16 ||
        tail / boxArea < 0.45) continue;
    if (!best || tail > best.area) best = { left, right, top, bottom, area: tail };
  }
  if (!best) return null;
  const padX = Math.max(4, Math.round((best.right - best.left) * sample * 0.025));
  const padY = Math.max(4, Math.round((best.bottom - best.top) * sample * 0.05));
  const x = Math.max(0, best.left * sample - padX);
  const y = Math.max(0, best.top * sample - padY);
  const right = Math.min(width, (best.right + 1) * sample + padX);
  const bottom = Math.min(height, (best.bottom + 1) * sample + padY);
  const frame = { x, y, width: right - x, height: bottom - y };
  return frame.width * frame.height / (width * height) > 0.9 ? null : frame;
}

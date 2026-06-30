/** Normalização ImageNet (padrão torchvision / YOLO export). */
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/**
 * Redimensiona ImageBitmap para tensor NCHW float32 [1, 3, H, W].
 * Letterbox com padding cinza 114 (padrão YOLO).
 *
 * @param {ImageBitmap} bitmap
 * @param {number} size — lado do quadrado (ex.: 320)
 * @returns {Float32Array}
 */
export function preprocessBitmapToNchw(bitmap, size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('OffscreenCanvas 2d indisponível');

  ctx.fillStyle = 'rgb(114,114,114)';
  ctx.fillRect(0, 0, size, size);

  const scale = Math.min(size / bitmap.width, size / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const dx = Math.floor((size - w) / 2);
  const dy = Math.floor((size - h) / 2);
  ctx.drawImage(bitmap, dx, dy, w, h);

  const { data } = ctx.getImageData(0, 0, size, size);
  const plane = size * size;
  const tensor = new Float32Array(3 * plane);

  for (let i = 0; i < plane; i += 1) {
    const px = i * 4;
    const r = data[px] / 255;
    const g = data[px + 1] / 255;
    const b = data[px + 2] / 255;
    tensor[i] = (r - MEAN[0]) / STD[0];
    tensor[plane + i] = (g - MEAN[1]) / STD[1];
    tensor[2 * plane + i] = (b - MEAN[2]) / STD[2];
  }

  return tensor;
}

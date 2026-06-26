import jsQR from 'jsqr';

/**
 * Tenta ler QR de NFC-e em imagem (foto da nota).
 * Estratégias: imagem inteira, recorte inferior (onde fica o QR), contraste reforçado.
 */

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function enhanceContrast(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const boosted = gray < 140 ? Math.max(0, gray * 0.55) : Math.min(255, gray * 1.35);
    d[i] = d[i + 1] = d[i + 2] = boosted;
  }
  return imageData;
}

function tryJsQr(imageData) {
  if (!imageData) return null;
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
  return result?.data?.trim() || null;
}

function decodeRegion(img, region, { enhance = false } = {}) {
  const sw = Math.max(1, Math.floor(img.width * region.w));
  const sh = Math.max(1, Math.floor(img.height * region.h));
  const sx = Math.floor(img.width * region.x);
  const sy = Math.floor(img.height * region.y);

  const maxDim = 1600;
  let dw = sw;
  let dh = sh;
  if (Math.max(dw, dh) > maxDim) {
    const s = maxDim / Math.max(dw, dh);
    dw = Math.floor(dw * s);
    dh = Math.floor(dh * s);
  }

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  let imageData = ctx.getImageData(0, 0, dw, dh);
  if (enhance) imageData = enhanceContrast(imageData);
  return tryJsQr(imageData);
}

const REGIONS = [
  { x: 0, y: 0, w: 1, h: 1 },
  { x: 0, y: 0.55, w: 1, h: 0.45 },
  { x: 0, y: 0.65, w: 1, h: 0.35 },
  { x: 0, y: 0.45, w: 1, h: 0.55 },
];

/**
 * @param {HTMLImageElement|ImageBitmap} img
 * @returns {string|null}
 */
export function scanQrFromImage(img) {
  if (!img?.width || !img?.height) return null;

  for (const region of REGIONS) {
    const text = decodeRegion(img, region);
    if (text) return text;
  }

  for (const region of REGIONS.slice(1)) {
    const text = decodeRegion(img, region, { enhance: true });
    if (text) return text;
  }

  return null;
}

/**
 * @param {string} dataUrl - data:image/...;base64,...
 * @returns {Promise<string|null>}
 */
export async function scanQrFromDataUrl(dataUrl) {
  if (!dataUrl || typeof window === 'undefined') return null;

  const img = await loadImageFromDataUrl(dataUrl);
  return scanQrFromImage(img);
}

/**
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function scanQrFromFile(file) {
  if (!file || typeof window === 'undefined') return null;

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      return scanQrFromDataUrl(canvas.toDataURL('image/jpeg', 0.92));
    } finally {
      try {
        bitmap.close();
      } catch (_) {}
    }
  }

  const reader = new FileReader();
  const dataUrl = await new Promise((resolve, reject) => {
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return scanQrFromDataUrl(dataUrl);
}

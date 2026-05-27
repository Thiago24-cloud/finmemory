const MAX_BYTES = 2.5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * @param {unknown} imageBase64
 * @returns {{ buffer: Buffer, mimeType: string, ext: string } | { error: string }}
 */
export function parseProductImageBase64(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return { error: 'Envie a imagem do produto.' };
  }

  let mimeType = 'image/jpeg';
  let data = imageBase64.trim();

  const dataUrlMatch = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(data);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase();
    data = dataUrlMatch[2];
  }

  if (!ALLOWED.has(mimeType)) {
    return { error: 'Use JPG, PNG ou WebP.' };
  }

  let buffer;
  try {
    buffer = Buffer.from(data, 'base64');
  } catch {
    return { error: 'Imagem inválida.' };
  }

  if (!buffer.length) return { error: 'Imagem vazia.' };
  if (buffer.length > MAX_BYTES) {
    return { error: 'Imagem muito grande (máx. 2,5 MB).' };
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return { buffer, mimeType, ext };
}

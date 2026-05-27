import { downloadRemoteImageBuffer } from '../ingestRemoteImageToProductImagesBucket.js';
import { uploadToR2, isR2Configured } from '../uploadToR2.js';
import { buildCatalogProductImageR2Key } from './buildCatalogProductImageR2Key.js';

/**
 * Descarrega imagem remota e publica no R2.
 * @param {string} sourceUrl
 * @param {string} keySeed
 * @returns {Promise<{ url: string, key: string } | null>}
 */
export async function ingestRemoteImageToR2(sourceUrl, keySeed) {
  if (!isR2Configured()) {
    console.warn('[ingestRemoteImageToR2] R2 não configurado');
    return null;
  }

  const url = String(sourceUrl || '').trim();
  if (!url.startsWith('https://')) return null;

  try {
    const { buf, ext, contentType } = await downloadRemoteImageBuffer(url);
    const key = buildCatalogProductImageR2Key(keySeed, ext);
    const uploaded = await uploadToR2(buf, key, contentType);
    if (!uploaded?.success || !uploaded.url) return null;
    return { url: uploaded.url, key: uploaded.key };
  } catch (e) {
    console.warn('[ingestRemoteImageToR2]', e?.message || e);
    return null;
  }
}

/**
 * Reutiliza URLs de miniatura entre linhas do mesmo produto (nome normalizado),
 * p.ex. promoção do agente sem imagem + price_point ou outra promo com foto.
 */
import { needsThumbnailEnrichment } from './enrichMapPointImages';

/** Mesma base que o cache OFF em enrichMapPointImages — chaves alinhadas entre APIs. */
export function mapProductNameNormKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

/**
 * @param {Array<{ product_name: string, url: string|null|undefined }>} pairs
 * @returns {Map<string, string>}
 */
export function buildImageUrlByNormKeyFromPairs(pairs) {
  const m = new Map();
  if (!Array.isArray(pairs)) return m;
  for (const { product_name, url } of pairs) {
    if (!url || typeof url !== 'string' || needsThumbnailEnrichment(url)) continue;
    const k = mapProductNameNormKey(product_name);
    if (!k) continue;
    if (!m.has(k)) m.set(k, url.trim());
  }
  return m;
}

/**
 * Copia promo_image_url entre linhas com o mesmo nome normalizado (mutável).
 * @param {Array<{ product_name: string, promo_image_url?: string|null }>} rows
 */
export function applyPeerPromoImageReuse(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const urlByKey = new Map();
  for (const r of rows) {
    const u = r.promo_image_url;
    if (!u || needsThumbnailEnrichment(u)) continue;
    const k = mapProductNameNormKey(r.product_name);
    if (!k) continue;
    if (!urlByKey.has(k)) urlByKey.set(k, u);
  }
  for (const r of rows) {
    if (!needsThumbnailEnrichment(r.promo_image_url)) continue;
    const k = mapProductNameNormKey(r.product_name);
    const u = k && urlByKey.get(k);
    if (u) r.promo_image_url = u;
  }
}

/**
 * @param {Array<{ product_name: string, promo_image_url?: string|null }>} rows
 * @param {Map<string, string>} urlByNormKey
 */
export function applyNormKeyImageLookup(rows, urlByNormKey) {
  if (!Array.isArray(rows) || !urlByNormKey || urlByNormKey.size === 0) return;
  for (const r of rows) {
    if (!needsThumbnailEnrichment(r.promo_image_url)) continue;
    const k = mapProductNameNormKey(r.product_name);
    const u = k && urlByNormKey.get(k);
    if (u && !needsThumbnailEnrichment(u)) r.promo_image_url = u;
  }
}

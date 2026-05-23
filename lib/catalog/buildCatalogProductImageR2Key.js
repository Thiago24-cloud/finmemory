import { createHash } from 'crypto';

/**
 * Chave R2 para imagens de produto do catálogo (promoções / mapa).
 * @param {string} seed — gtin, nome normalizado ou id
 * @param {string} [ext]
 */
export function buildCatalogProductImageR2Key(seed, ext = 'jpg') {
  const safeExt = String(ext || 'jpg').replace(/^\./, '').toLowerCase() || 'jpg';
  const base = String(seed || 'unknown')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80);
  const hash = createHash('sha1').update(String(seed)).digest('hex').slice(0, 10);
  return `catalog-products/${base || 'item'}-${hash}.${safeExt}`;
}

/**
 * Alinha `stores.name` ↔ `price_points.store_name` (acentos, espaços).
 * Usado no mapa e no painel operacional.
 * @param {string} name
 */
export function normalizeStoreNameMatchKey(name) {
  return String(name || '')
    .trim()
    .replace(/[\u2013\u2014\u2212\u2010\u2011\u2012\u2015]/g, '-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

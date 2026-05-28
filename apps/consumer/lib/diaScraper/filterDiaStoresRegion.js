import { SP_GRANDE_SP_CITIES, normalizeGeoText, inferSpMacroRegion } from '../ingest/run.js';

/** Slug capital: sp-sao-paulo-* (município São Paulo). */
export function isDiaCapitalSlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  return s.startsWith('sp-sao-paulo-');
}

/**
 * Grande SP (capital + RM, sem interior/litoral distante).
 * @param {{ slug?: string, city?: string, storeUrl?: string }} store
 */
export function isDiaStoreGrandeSp(store) {
  const slug =
    String(store?.slug || '').trim() ||
    (() => {
      const u = String(store?.storeUrl || '');
      const m = u.match(/\/lojas\/([^/]+)\/?$/i);
      return m ? m[1] : '';
    })();

  if (isDiaCapitalSlug(slug)) return true;

  const cityNorm = normalizeGeoText(store?.city);
  if (SP_GRANDE_SP_CITIES.has(cityNorm)) return true;

  const region = inferSpMacroRegion(store?.city);
  if (region === 'Interior' || region === 'Litoral') return false;

  return false;
}

/**
 * @param {object[]} stores
 * @param {'grande_sp' | 'all_sp'} [region]
 */
export function filterDiaStoresByRegion(stores, region = 'grande_sp') {
  const list = Array.isArray(stores) ? stores : [];
  if (region === 'all_sp') return list;
  return list.filter((s) => isDiaStoreGrandeSp(s));
}

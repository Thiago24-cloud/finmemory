/**
 * Cliente HTTP Cosmos Bluesoft (endpoints oficiais).
 * @see https://api.cosmos.bluesoft.com.br/
 */
import { getCosmosToken } from '../cosmos.js';

export const COSMOS_ORIGIN = 'https://api.cosmos.bluesoft.com.br';

export function normalizeCosmosGtin(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

/** @param {string} productName */
export function normalizeProductNameForCosmos(productName) {
  let q = String(productName || '')
    .replace(/\s+/g, ' ')
    .replace(/\b(leve|pague|pack|kit)\b[^.]{0,40}/gi, ' ')
    .replace(/\b\d+\s*%\s*off\b/gi, ' ')
    .trim();
  if (q.length > 120) q = q.slice(0, 120);
  return q;
}

function cosmosHeaders(token) {
  return {
    'X-Cosmos-Token': token,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'FinMemory/1.0 (cosmos-api)',
  };
}

function useRetailerApi() {
  return String(process.env.COSMOS_USE_RETAILER_API || '').trim() === '1';
}

/** @param {unknown} payload */
export function extractCosmosProductList(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const p = /** @type {Record<string, unknown>} */ (payload);
  if (Array.isArray(p)) return p;
  if (Array.isArray(p.products)) return p.products;
  if (Array.isArray(p.data)) return p.data;
  if (p.data && typeof p.data === 'object') {
    const d = /** @type {Record<string, unknown>} */ (p.data);
    if (Array.isArray(d.products)) return d.products;
  }
  return [];
}

/** @param {unknown} item */
export function mapCosmosProductHit(item) {
  if (!item || typeof item !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (item);
  const gtin = normalizeCosmosGtin(o.gtin ?? o.ean ?? o.barcode);
  const thumb = String(o.thumbnail ?? o.image_url ?? o.image ?? '').trim();
  const name = String(o.description ?? o.name ?? o.product_name ?? '').trim();
  const imageUrl = thumb.startsWith('https://') ? thumb : null;
  return { gtin, imageUrl, name };
}

/** @param {string} wantedNorm */
function scoreCosmosNameMatch(productName, wantedNorm) {
  const pn = String(productName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!pn || !wantedNorm) return 0;
  const words = wantedNorm.split(/\s+/).filter((w) => w.length > 2);
  let score = 0;
  for (const w of words) {
    if (pn.includes(w)) score += 1;
  }
  return score;
}

/**
 * @param {string} query
 * @param {unknown[]} items
 */
export function pickBestCosmosProduct(query, items) {
  const wanted = normalizeProductNameForCosmos(query)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const raw of items) {
    const hit = mapCosmosProductHit(raw);
    if (!hit) continue;
    const score = scoreCosmosNameMatch(hit.name, wanted);
    if (score > bestScore) {
      bestScore = score;
      best = hit;
    }
  }
  if (best && bestScore >= 2) return best;
  const first = mapCosmosProductHit(items[0]);
  return first;
}

/**
 * GET /gtins/{código} ou GET /retailers/gtins/{código}
 * @param {string} gtin
 */
export async function fetchCosmosProductByGtin(gtin, options = {}) {
  const token = getCosmosToken();
  const code = normalizeCosmosGtin(gtin);
  if (!token || !code) return null;

  const retailer = options.retailer ?? useRetailerApi();
  const path = retailer ? `/retailers/gtins/${code}` : `/gtins/${code}`;
  const res = await fetch(`${COSMOS_ORIGIN}${path}`, {
    headers: cosmosHeaders(token),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (res?.status === 404) return null;
  if (!res?.ok) {
    if (!retailer && useRetailerApi()) {
      return fetchCosmosProductByGtin(gtin, { retailer: true });
    }
    return null;
  }

  const j = await res.json().catch(() => null);
  if (!j || typeof j !== 'object') return null;
  const hit = mapCosmosProductHit(j) || { gtin: code, imageUrl: null, name: '' };
  if (!hit.name && j.description) hit.name = String(j.description).trim();
  if (!hit.imageUrl) {
    const thumb = String(j.thumbnail || '').trim();
    if (thumb.startsWith('https://')) hit.imageUrl = thumb;
    else if (hit.gtin) hit.imageUrl = `https://cdn-cosmos.bluesoft.com.br/products/${hit.gtin}`;
  }
  return hit.imageUrl ? hit : null;
}

/**
 * GET /products?query= ou GET /retailers/products?query=
 * @param {string} query
 */
export async function searchCosmosProductsByQuery(query, options = {}) {
  const token = getCosmosToken();
  const q = normalizeProductNameForCosmos(query);
  if (!token || q.length < 3) return [];

  const gtinOnly = normalizeCosmosGtin(q);
  if (gtinOnly && String(q).replace(/\D/g, '') === gtinOnly) {
    const one = await fetchCosmosProductByGtin(gtinOnly, options);
    return one ? [one] : [];
  }

  const retailer = options.retailer ?? useRetailerApi();
  const path = retailer ? '/retailers/products' : '/products';
  const page = Math.max(1, Number(options.page) || 1);
  const url = new URL(`${COSMOS_ORIGIN}${path}`);
  url.searchParams.set('query', q);
  if (page > 1) url.searchParams.set('page', String(page));

  const res = await fetch(url.toString(), {
    headers: cosmosHeaders(token),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!res?.ok) {
    if (!retailer && useRetailerApi()) {
      return searchCosmosProductsByQuery(query, { ...options, retailer: true });
    }
    return [];
  }

  const j = await res.json().catch(() => ({}));
  return extractCosmosProductList(j)
    .map((item) => mapCosmosProductHit(item))
    .filter(Boolean);
}

/**
 * Melhor imagem para um nome de produto (API oficial).
 * @param {string} productName
 * @returns {Promise<{ gtin: string | null, imageUrl: string, name: string, source: string } | null>}
 */
export async function resolveCosmosImageByProductName(productName) {
  const q = normalizeProductNameForCosmos(productName);
  if (q.length < 3) return null;

  const items = await searchCosmosProductsByQuery(q);
  let best = pickBestCosmosProduct(q, items);

  if (best?.gtin && !best.imageUrl) {
    const full = await fetchCosmosProductByGtin(best.gtin);
    if (full?.imageUrl) best = { ...best, imageUrl: full.imageUrl, name: full.name || best.name };
  }

  if (!best?.imageUrl && items.length === 0 && useRetailerApi()) {
    const retailerItems = await searchCosmosProductsByQuery(q, { retailer: true });
    best = pickBestCosmosProduct(q, retailerItems);
    if (best?.gtin && !best.imageUrl) {
      const full = await fetchCosmosProductByGtin(best.gtin, { retailer: true });
      if (full?.imageUrl) best = { ...best, imageUrl: full.imageUrl, name: full.name || best.name };
    }
  }

  if (!best?.imageUrl) return null;
  return {
    gtin: best.gtin || null,
    imageUrl: best.imageUrl,
    name: best.name || q,
    source: 'cosmos_products_query',
  };
}

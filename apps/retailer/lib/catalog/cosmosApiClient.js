/**
 * Cliente HTTP Cosmos Bluesoft para enriquecer leituras de GTIN/EAN no painel lojista.
 * Mantém o token no servidor e devolve apenas dados de catálogo necessários ao cadastro.
 */
import { getCosmosToken } from '../cosmos';

export const COSMOS_ORIGIN = 'https://api.cosmos.bluesoft.com.br';

export function normalizeCosmosGtin(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

export function normalizeProductNameForCosmos(productName) {
  let query = String(productName || '')
    .replace(/\s+/g, ' ')
    .replace(/\b(leve|pague|pack|kit)\b[^.]{0,40}/gi, ' ')
    .replace(/\b\d+\s*%\s*off\b/gi, ' ')
    .trim();
  if (query.length > 120) query = query.slice(0, 120);
  return query;
}

function cosmosHeaders(token) {
  return {
    'X-Cosmos-Token': token,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'FinMemory Parceiros/1.0 (cosmos-barcode-lookup)',
  };
}

function shouldUseRetailerApi() {
  return String(process.env.COSMOS_USE_RETAILER_API || '').trim() === '1';
}

function stringOrNull(value) {
  const s = String(value || '').trim();
  return s || null;
}

function extractBrandName(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const brand = payload.brand;
  if (typeof brand === 'string') return stringOrNull(brand);
  if (brand && typeof brand === 'object') {
    return stringOrNull(brand.name || brand.description || brand.title);
  }
  return stringOrNull(payload.brand_name || payload.brandName);
}

export function mapCosmosGtinPayload(payload, fallbackGtin) {
  if (!payload || typeof payload !== 'object') return null;

  const gtin = normalizeCosmosGtin(payload.gtin ?? payload.ean ?? payload.barcode ?? fallbackGtin);
  const name = stringOrNull(payload.description ?? payload.name ?? payload.product_name);
  if (!gtin || !name) return null;

  const thumbnail = stringOrNull(payload.thumbnail ?? payload.image_url ?? payload.image);
  const imageUrl = thumbnail?.startsWith('https://') ? thumbnail : null;

  return {
    gtin,
    name,
    brand: extractBrandName(payload),
    imageUrl: imageUrl || `https://cdn-cosmos.bluesoft.com.br/products/${gtin}`,
    source: 'cosmos',
  };
}

export function extractCosmosProductList(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.products)) return payload.products;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === 'object' && Array.isArray(payload.data.products)) {
    return payload.data.products;
  }
  return [];
}

export function mapCosmosProductHit(item) {
  if (!item || typeof item !== 'object') return null;
  const gtin = normalizeCosmosGtin(item.gtin ?? item.ean ?? item.barcode);
  const name = stringOrNull(item.description ?? item.name ?? item.product_name);
  if (!name) return null;
  const thumbnail = stringOrNull(item.thumbnail ?? item.image_url ?? item.image);
  const imageUrl = thumbnail?.startsWith('https://') ? thumbnail : null;
  return {
    gtin,
    name,
    brand: extractBrandName(item),
    imageUrl,
    source: 'cosmos_products_query',
  };
}

function scoreCosmosNameMatch(productName, wantedNorm) {
  const productNorm = String(productName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!productNorm || !wantedNorm) return 0;
  const words = wantedNorm.split(/\s+/).filter((word) => word.length > 2);
  let score = 0;
  for (const word of words) {
    if (productNorm.includes(word)) score += 1;
  }
  return score;
}

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
  return mapCosmosProductHit(items[0]);
}

/**
 * GET /gtins/{codigo} ou /retailers/gtins/{codigo}, conforme COSMOS_USE_RETAILER_API.
 */
export async function fetchCosmosProductByGtin(gtin, options = {}) {
  const token = getCosmosToken();
  const code = normalizeCosmosGtin(gtin);
  if (!token || !code) return null;

  const retailer = options.retailer ?? shouldUseRetailerApi();
  const path = retailer ? `/retailers/gtins/${code}` : `/gtins/${code}`;
  const res = await fetch(`${COSMOS_ORIGIN}${path}`, {
    headers: cosmosHeaders(token),
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);

  if (res?.status === 404) return null;
  if (!res?.ok) {
    if (!retailer && shouldUseRetailerApi()) {
      return fetchCosmosProductByGtin(code, { retailer: true });
    }
    return null;
  }

  const json = await res.json().catch(() => null);
  return mapCosmosGtinPayload(json, code);
}

export async function searchCosmosProductsByQuery(query, options = {}) {
  const token = getCosmosToken();
  const q = normalizeProductNameForCosmos(query);
  if (!token || q.length < 3) return [];

  const gtinOnly = normalizeCosmosGtin(q);
  if (gtinOnly && String(q).replace(/\D/g, '') === gtinOnly) {
    const one = await fetchCosmosProductByGtin(gtinOnly, options);
    return one ? [one] : [];
  }

  const retailer = options.retailer ?? shouldUseRetailerApi();
  const path = retailer ? '/retailers/products' : '/products';
  const url = new URL(`${COSMOS_ORIGIN}${path}`);
  url.searchParams.set('query', q);

  const res = await fetch(url.toString(), {
    headers: cosmosHeaders(token),
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);

  if (!res?.ok) {
    if (!retailer && shouldUseRetailerApi()) {
      return searchCosmosProductsByQuery(q, { retailer: true });
    }
    return [];
  }

  const json = await res.json().catch(() => ({}));
  return extractCosmosProductList(json)
    .map((item) => mapCosmosProductHit(item))
    .filter(Boolean);
}

export async function resolveCosmosProductImage({ gtin, name }) {
  const exact = gtin ? await fetchCosmosProductByGtin(gtin) : null;
  if (exact?.imageUrl) {
    return {
      gtin: exact.gtin,
      name: exact.name,
      brand: exact.brand,
      imageUrl: exact.imageUrl,
      source: 'cosmos_gtin',
    };
  }

  const q = normalizeProductNameForCosmos(name);
  if (q.length < 3) return exact?.imageUrl ? exact : null;

  const items = await searchCosmosProductsByQuery(q);
  let best = pickBestCosmosProduct(q, items);
  if (best?.gtin && !best.imageUrl) {
    const full = await fetchCosmosProductByGtin(best.gtin);
    if (full?.imageUrl) best = { ...best, imageUrl: full.imageUrl, name: full.name || best.name };
  }

  if (!best?.imageUrl) return null;
  return {
    gtin: best.gtin || null,
    name: best.name || q,
    brand: best.brand || null,
    imageUrl: best.imageUrl,
    source: best.source || 'cosmos_products_query',
  };
}

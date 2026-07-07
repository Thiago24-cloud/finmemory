/**
 * Cliente HTTP Cosmos Bluesoft (endpoints oficiais).
 * @see https://api.cosmos.bluesoft.com.br/
 */
import { getCosmosToken } from './token';

export const COSMOS_ORIGIN = 'https://api.cosmos.bluesoft.com.br';

export type CosmosProduct = {
  gtin: string | null;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  source?: string;
};

export function normalizeCosmosGtin(value: unknown): string | null {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

export function normalizeProductNameForCosmos(productName: unknown): string {
  let query = String(productName || '')
    .replace(/\s+/g, ' ')
    .replace(/\b(leve|pague|pack|kit)\b[^.]{0,40}/gi, ' ')
    .replace(/\b\d+\s*%\s*off\b/gi, ' ')
    .trim();
  if (query.length > 120) query = query.slice(0, 120);
  return query;
}

function cosmosHeaders(token: string) {
  return {
    'X-Cosmos-Token': token,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'FinMemory/1.0 (cosmos-api)',
  };
}

function shouldUseRetailerApi(): boolean {
  return String(process.env.COSMOS_USE_RETAILER_API || '').trim() === '1';
}

function stringOrNull(value: unknown): string | null {
  const s = String(value || '').trim();
  return s || null;
}

function extractBrandName(payload: Record<string, unknown>): string | null {
  const brand = payload.brand;
  if (typeof brand === 'string') return stringOrNull(brand);
  if (brand && typeof brand === 'object') {
    const b = brand as Record<string, unknown>;
    return stringOrNull(b.name || b.description || b.title);
  }
  return stringOrNull(payload.brand_name || payload.brandName);
}

export function mapCosmosGtinPayload(
  payload: unknown,
  fallbackGtin?: string | null
): CosmosProduct | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = payload as Record<string, unknown>;
  const gtin = normalizeCosmosGtin(row.gtin ?? row.ean ?? row.barcode ?? fallbackGtin);
  const name = stringOrNull(row.description ?? row.name ?? row.product_name);
  if (!gtin || !name) return null;

  const thumbnail = stringOrNull(row.thumbnail ?? row.image_url ?? row.image);
  const imageUrl = thumbnail?.startsWith('https://')
    ? thumbnail
    : `https://cdn-cosmos.bluesoft.com.br/products/${gtin}`;

  return {
    gtin,
    name,
    brand: extractBrandName(row),
    imageUrl,
    source: 'cosmos',
  };
}

export function extractCosmosProductList(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload)) return payload;
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.products)) return p.products;
  if (Array.isArray(p.data)) return p.data;
  if (p.data && typeof p.data === 'object') {
    const d = p.data as Record<string, unknown>;
    if (Array.isArray(d.products)) return d.products;
  }
  return [];
}

export function mapCosmosProductHit(item: unknown): CosmosProduct | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const gtin = normalizeCosmosGtin(row.gtin ?? row.ean ?? row.barcode);
  const name = stringOrNull(row.description ?? row.name ?? row.product_name);
  if (!name) return null;
  const thumbnail = stringOrNull(row.thumbnail ?? row.image_url ?? row.image);
  const imageUrl = thumbnail?.startsWith('https://') ? thumbnail : null;
  return {
    gtin,
    name,
    brand: extractBrandName(row),
    imageUrl,
    source: 'cosmos_products_query',
  };
}

function scoreCosmosNameMatch(productName: string, wantedNorm: string): number {
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

export function pickBestCosmosProduct(
  query: string,
  items: unknown[]
): CosmosProduct | null {
  const wanted = normalizeProductNameForCosmos(query)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  let best: CosmosProduct | null = null;
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
 * GET /gtins/{codigo} ou /retailers/gtins/{codigo}
 */
export async function fetchCosmosProductByGtin(
  gtin: string,
  options: { retailer?: boolean } = {}
): Promise<CosmosProduct | null> {
  const token = getCosmosToken();
  const code = normalizeCosmosGtin(gtin);
  if (!token || !code) return null;

  const retailer = options.retailer ?? shouldUseRetailerApi();
  const path = retailer ? `/retailers/gtins/${code}` : `/gtins/${code}`;
  const res = await fetch(`${COSMOS_ORIGIN}${path}`, {
    headers: cosmosHeaders(token),
    signal: AbortSignal.timeout(15_000),
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

/**
 * GET /products?query= ou /retailers/products?query=
 */
export async function searchCosmosProductsByQuery(
  query: string,
  options: { retailer?: boolean; page?: number } = {}
): Promise<CosmosProduct[]> {
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
  const page = Math.max(1, Number(options.page) || 1);
  const url = new URL(`${COSMOS_ORIGIN}${path}`);
  url.searchParams.set('query', q);
  if (page > 1) url.searchParams.set('page', String(page));

  const res = await fetch(url.toString(), {
    headers: cosmosHeaders(token),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!res?.ok) {
    if (!retailer && shouldUseRetailerApi()) {
      return searchCosmosProductsByQuery(query, { ...options, retailer: true });
    }
    return [];
  }

  const json = await res.json().catch(() => ({}));
  return extractCosmosProductList(json)
    .map((item) => mapCosmosProductHit(item))
    .filter((item): item is CosmosProduct => Boolean(item));
}

/**
 * Melhor imagem/dados por GTIN e/ou nome (usado no painel lojista e catálogo).
 */
export async function resolveCosmosProductImage({
  gtin,
  name,
}: {
  gtin?: string | null;
  name?: string | null;
}): Promise<CosmosProduct | null> {
  const exact = gtin ? await fetchCosmosProductByGtin(gtin) : null;
  if (exact?.imageUrl) {
    return {
      ...exact,
      source: 'cosmos_gtin',
    };
  }

  const q = normalizeProductNameForCosmos(name);
  if (q.length < 3) return exact?.imageUrl ? exact : null;

  const items = await searchCosmosProductsByQuery(q);
  let best = pickBestCosmosProduct(q, items);
  if (best?.gtin && !best.imageUrl) {
    const full = await fetchCosmosProductByGtin(best.gtin);
    if (full?.imageUrl) {
      best = { ...best, imageUrl: full.imageUrl, name: full.name || best.name };
    }
  }

  if (!best?.imageUrl && items.length === 0 && shouldUseRetailerApi()) {
    const retailerItems = await searchCosmosProductsByQuery(q, { retailer: true });
    best = pickBestCosmosProduct(q, retailerItems);
    if (best?.gtin && !best.imageUrl) {
      const full = await fetchCosmosProductByGtin(best.gtin, { retailer: true });
      if (full?.imageUrl) {
        best = { ...best, imageUrl: full.imageUrl, name: full.name || best.name };
      }
    }
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

/** Alias usado no app consumidor (busca só por nome). */
export async function resolveCosmosImageByProductName(productName: string) {
  const hit = await resolveCosmosProductImage({ name: productName });
  if (!hit?.imageUrl) return null;
  return {
    gtin: hit.gtin || null,
    imageUrl: hit.imageUrl,
    name: hit.name,
    source: hit.source || 'cosmos_products_query',
  };
}

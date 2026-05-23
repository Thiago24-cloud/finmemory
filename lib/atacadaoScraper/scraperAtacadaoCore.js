import { parsePriceBR } from '../ingest/money.js';
import {
  SP_GRANDE_SP_CITIES,
  inferDddByCity,
  inferMacroRegion,
  normalizeGeoText,
} from '../ingest/run.js';
import { geocodeAddress } from '../geocode.js';
import { splitProdutosByPublishReadiness } from '../promoQueueProcessing.js';
import { afterMapPricePointsInsert } from '../catalog/afterMapPricePointsInsert.js';

export const SCRAPER_ATACADAO_ORIGEM = 'scraper_atacadao';
export const SCRAPER_ATACADAO_PRICE_SOURCE = 'scraper_atacadao';
export const ATACADAO_BASE_URL = 'https://www.atacadao.com.br';
export const ATACADAO_PAGE_SIZE = 50;
export const ATACADAO_MAX_PRODUCTS = 500;

const ATACADAO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** @returns {string} YYYY-MM-DD (America/Sao_Paulo) */
export function nextSundayYmdBrazil(from = new Date()) {
  const tz = 'America/Sao_Paulo';
  const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  const ymdFmt = new Intl.DateTimeFormat('fr-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const base = from.getTime();
  for (let i = 0; i < 14; i++) {
    const d = new Date(base + i * 86400000);
    if (weekdayFmt.format(d) === 'Sun') return ymdFmt.format(d);
  }
  return ymdFmt.format(new Date(base));
}

/** @param {string | null | undefined} value */
export function toIsoDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + 'T12:00:00Z');
    return Number.isNaN(d.getTime()) ? null : s.slice(0, 10);
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const d = new Date(`${iso}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  return null;
}

export function inferLocalityForCity(city) {
  const cityTrim = String(city || '').trim();
  if (!cityTrim) {
    return {
      locality_scope: 'Estadual',
      locality_city: null,
      locality_region: null,
      locality_state: 'SP',
      ddd_code: null,
      is_statewide: false,
    };
  }
  const n = normalizeGeoText(cityTrim);
  const locality_scope = SP_GRANDE_SP_CITIES.has(n) ? 'Grande SP' : 'Cidade';
  return {
    locality_scope,
    locality_city: cityTrim,
    locality_region: inferMacroRegion(cityTrim),
    locality_state: 'SP',
    ddd_code: inferDddByCity(cityTrim),
    is_statewide: false,
  };
}

/** @param {{ addressForGeocode: string }} store */
export async function resolveAtacadaoStoreLatLng(store) {
  const q = `Atacadão, ${store.addressForGeocode}, Brasil`;
  const coords = await geocodeAddress(q);
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    return { lat: coords.lat, lng: coords.lng };
  }
  return { lat: null, lng: null };
}

/**
 * Merges two sets of cookies, with newRawCookies overriding existing by name.
 * @param {string} existing  - current Cookie header string
 * @param {string[]} newRawCookies  - raw Set-Cookie strings
 * @returns {string}
 */
function mergeCookies(existing, newRawCookies) {
  const map = new Map();
  for (const part of existing.split('; ')) {
    const eq = part.indexOf('=');
    if (eq > 0) map.set(part.slice(0, eq), part);
  }
  for (const raw of newRawCookies) {
    const part = raw.split(';')[0].trim();
    const eq = part.indexOf('=');
    if (eq > 0) map.set(part.slice(0, eq), part);
  }
  return Array.from(map.values()).join('; ');
}

/**
 * Creates a VTEX session tied to the store closest to the given CEP.
 * @param {string} cep  - 8-digit CEP (digits only)
 * @returns {Promise<string>}  - cookie string for subsequent requests
 */
export async function createVtexSession(cep) {
  const cepClean = String(cep).replace(/\D/g, '');

  const postRes = await fetch(`${ATACADAO_BASE_URL}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': ATACADAO_UA,
      Accept: 'application/json',
    },
    body: '{}',
  });

  if (!postRes.ok) {
    const body = await postRes.text().catch(() => '');
    throw new Error(`VTEX POST session HTTP ${postRes.status}: ${body.slice(0, 200)}`);
  }

  const postSetCookies = postRes.headers.getSetCookie
    ? postRes.headers.getSetCookie()
    : [postRes.headers.get('set-cookie')].filter(Boolean);

  let cookieStr = postSetCookies
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');

  if (!cookieStr) {
    throw new Error('VTEX session: nenhum cookie retornado no POST');
  }

  const patchRes = await fetch(`${ATACADAO_BASE_URL}/api/sessions`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': ATACADAO_UA,
      Accept: 'application/json',
      Cookie: cookieStr,
    },
    body: JSON.stringify({ public: { postalCode: { value: cepClean } } }),
  });

  if (!patchRes.ok) {
    const body = await patchRes.text().catch(() => '');
    throw new Error(`VTEX PATCH session HTTP ${patchRes.status}: ${body.slice(0, 200)}`);
  }

  const patchSetCookies = patchRes.headers.getSetCookie
    ? patchRes.headers.getSetCookie()
    : [patchRes.headers.get('set-cookie')].filter(Boolean);

  if (patchSetCookies.length > 0) {
    cookieStr = mergeCookies(cookieStr, patchSetCookies);
  }

  return cookieStr;
}

/**
 * Fetches one page of products from the VTEX catalog for the store selected in the session.
 * @param {string} cookieStr
 * @param {number} from
 * @param {number} to
 * @returns {Promise<object[]>}
 */
export async function fetchVtexPageProducts(cookieStr, from, to) {
  const url = `${ATACADAO_BASE_URL}/api/catalog_system/pub/products/search/?_from=${from}&_to=${to}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': ATACADAO_UA,
      Accept: 'application/json',
      Cookie: cookieStr,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`VTEX catalog HTTP ${res.status} (from=${from}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Fetches all products for the store nearest to the CEP, paginating until done or limit reached.
 * @param {string} cep  - 8-digit CEP
 * @returns {Promise<{ products: object[], cookieStr: string }>}
 */
export async function fetchAllStoreProducts(cep) {
  const cookieStr = await createVtexSession(cep);
  const allProducts = [];
  let from = 0;

  while (from < ATACADAO_MAX_PRODUCTS) {
    const to = from + ATACADAO_PAGE_SIZE - 1;
    const page = await fetchVtexPageProducts(cookieStr, from, to);
    if (page.length === 0) break;
    allProducts.push(...page);
    if (page.length < ATACADAO_PAGE_SIZE) break;
    from += ATACADAO_PAGE_SIZE;
    // Polite delay between pages
    await new Promise((r) => setTimeout(r, 300));
  }

  return { products: allProducts, cookieStr };
}

/**
 * Converts a VTEX product object into a produto da fila entry.
 * @param {object} vtexProduct
 * @param {string} cnpj
 * @param {string} sundayFallbackYmd
 * @returns {object | null}
 */
function mapVtexProductToProdutoFila(vtexProduct, cnpj, sundayFallbackYmd) {
  const nome = String(vtexProduct?.productName || '').trim();
  if (!nome) return null;

  const item = Array.isArray(vtexProduct.items) ? vtexProduct.items[0] : null;
  if (!item) return null;

  const seller = Array.isArray(item.sellers) ? item.sellers[0] : null;
  if (!seller) return null;

  const offer = seller.commertialOffer;
  if (!offer) return null;

  const available = Number(offer.AvailableQuantity);
  if (available <= 0) return null;

  const price = typeof offer.Price === 'number' ? offer.Price : null;
  if (price == null || price <= 0) return null;

  const measureUnit = String(item.measurementUnit || '').trim();
  const unitMultiplier = Number(item.unitMultiplier) || 1;
  const unidade = measureUnit
    ? unitMultiplier !== 1
      ? `${unitMultiplier} ${measureUnit}`
      : measureUnit
    : '';

  let validUntil = null;
  if (offer.PriceValidUntil) {
    validUntil = toIsoDateOnly(String(offer.PriceValidUntil));
  }
  if (!validUntil) validUntil = sundayFallbackYmd;

  const listPrice = typeof offer.ListPrice === 'number' ? offer.ListPrice : null;

  const images = Array.isArray(item.images) ? item.images : [];
  const imagemUrl = String(images[0]?.imageUrl || offer?.Images?.[0] || '').trim() || null;

  return {
    nome,
    preco: price,
    imagem_url: imagemUrl,
    unidade: unidade || null,
    valid_until: validUntil,
    metadata: {
      extraction_strategy: 'scraper_atacadao_vtex_api',
      source: SCRAPER_ATACADAO_ORIGEM,
      cnpj,
      vtex_product_id: String(vtexProduct.productId || ''),
      original_price: listPrice,
    },
  };
}

/**
 * @param {object[]} vtexProducts
 * @param {string} cnpj
 * @param {string} sundayFallbackYmd
 * @returns {object[]}
 */
export function mapVtexProductsToProdutosFila(vtexProducts, cnpj, sundayFallbackYmd) {
  const out = [];
  for (const p of vtexProducts || []) {
    const mapped = mapVtexProductToProdutoFila(p, cnpj, sundayFallbackYmd);
    if (mapped) out.push(mapped);
  }
  return out;
}

/**
 * Crons Atacadão (unidades do catálogo): audita na fila como aprovado e publica no mapa.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} filaRow
 * @param {string} ownerUserId
 */
export async function insertApprovedFilaAndPublishScraperAtacadao(supabase, filaRow, ownerUserId) {
  const {
    store_name,
    store_address,
    store_lat,
    store_lng,
    locality_scope,
    locality_city,
    locality_region,
    locality_state,
    ddd_code,
    is_statewide,
    produtos,
    artifacts,
  } = filaRow;

  const now = new Date().toISOString();

  const { data: insertedFila, error: filaErr } = await supabase
    .from('bot_promocoes_fila')
    .insert({
      store_name,
      store_address: store_address || null,
      store_lat,
      store_lng,
      locality_scope,
      locality_city,
      locality_region,
      locality_state,
      ddd_code,
      is_statewide: Boolean(is_statewide),
      produtos,
      artifacts: artifacts && typeof artifacts === 'object' ? artifacts : {},
      origem: SCRAPER_ATACADAO_ORIGEM,
      status: 'aprovado',
      reviewed_at: now,
      reviewed_by: 'api/scraper/atacadao',
    })
    .select('id')
    .single();

  if (filaErr) {
    return { ok: false, step: 'bot_promocoes_fila', error: filaErr.message };
  }

  const split = splitProdutosByPublishReadiness(produtos);
  if (split.ready.length === 0) {
    return {
      ok: true,
      filaId: insertedFila?.id,
      inserted: 0,
      note: 'Fila gravada; nenhum produto com preço e imagem para o mapa',
    };
  }

  const { error: storeRpcErr } = await supabase.rpc('find_or_create_store', {
    p_name: store_name,
    p_address: store_address || '',
    p_lat: store_lat,
    p_lng: store_lng,
  });
  if (storeRpcErr) {
    return { ok: false, step: 'find_or_create_store', error: storeRpcErr.message, filaId: insertedFila?.id };
  }

  const defaultTtlHours = Math.max(
    1,
    Math.min(parseInt(String(process.env.SCRAPER_ATACADAO_REPLACE_HOURS || '24'), 10) || 24, 168)
  );
  const cutoffIso = new Date(Date.now() - defaultTtlHours * 60 * 60 * 1000).toISOString();

  const { error: delErr } = await supabase
    .from('price_points')
    .delete()
    .eq('store_name', store_name)
    .eq('source', SCRAPER_ATACADAO_PRICE_SOURCE)
    .gte('created_at', cutoffIso)
    .ilike('category', '%promo%');

  if (delErr) {
    return { ok: false, step: 'price_points_delete', error: delErr.message, filaId: insertedFila?.id };
  }

  const rows = split.ready.map((p) => {
    const originalPrice = Number(p?.raw?.original_price ?? p?.raw?.preco_de);
    const discountPercent =
      Number.isFinite(originalPrice) &&
      originalPrice > 0 &&
      Number(p.price) > 0 &&
      Number(p.price) < originalPrice
        ? Number((((originalPrice - Number(p.price)) / originalPrice) * 100).toFixed(2))
        : null;

    const locCity = locality_city || p?.raw?.locality_city || null;
    const statewide = Boolean(is_statewide);
    const expiresAt = toIsoDateOnly(p.valid_until || p?.raw?.valid_until) || null;

    return {
      user_id: ownerUserId,
      store_name,
      lat: store_lat,
      lng: store_lng,
      product_name: p.name,
      price: Number(p.price),
      image_url: p.image_url || null,
      category: 'Supermercado - Promoção',
      source: SCRAPER_ATACADAO_PRICE_SOURCE,
      created_at: now,
      atualizado_em: now,
      locality_scope: statewide ? 'Estadual' : locality_scope || 'Estadual',
      locality_city: statewide ? null : locCity,
      locality_region: statewide ? null : locality_region || inferMacroRegion(locCity || locality_city || ''),
      locality_state: locality_state || 'SP',
      ddd_code: ddd_code || p?.raw?.ddd_code || null,
      is_statewide: statewide,
      expires_at: expiresAt,
      discount_percent: discountPercent,
      unit_normalized: p.unit || null,
    };
  });

  const { error: insertErr } = await supabase.from('price_points').insert(rows);
  if (insertErr) {
    return { ok: false, step: 'price_points_insert', error: insertErr.message, filaId: insertedFila?.id };
  }

  afterMapPricePointsInsert({ rows, storeName: store_name, source: SCRAPER_ATACADAO_PRICE_SOURCE });

  return {
    ok: true,
    filaId: insertedFila?.id,
    inserted: rows.length,
    offersTotal: Array.isArray(produtos) ? produtos.length : 0,
    invalidPrice: split.invalid.length,
    autoPublished: true,
  };
}

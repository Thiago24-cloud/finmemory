import { normalizeCnpjDigits } from './cnpj.js';
import { parsePriceBR } from './money.js';

/** @typedef {{ productName: string, price: number, validUntil: string | null, unit?: string | null, originalPrice?: number | null, imageUrl?: string | null }} NormalizedPromoItem */

/**
 * @typedef {Object} NormalizedPromoRun
 * @property {string} ingestSource identificador estável da fonte (ex.: dia_store_page)
 * @property {string} runId correlaciona logs / reprocessamento
 * @property {string} storeDisplayName nome no mapa (store_name em price_points)
 * @property {number} lat
 * @property {number} lng
 * @property {string} mapCategory categoria no mapa (ex.: Supermercado - Promoção)
 * @property {NormalizedPromoItem[]} items
 * @property {string | null} [storeCnpj] 14 dígitos, se conhecido
 * @property {Record<string, unknown>} [metadata] rastreio (ex.: storePageUrl)
 */

export const INGEST_SOURCE_DIA_STORE_PAGE = 'dia_store_page';
export const SP_CAPITAL_CITY = 'São Paulo';

export const SP_GRANDE_SP_CITIES = new Set([
  'sao paulo', 'guarulhos', 'osasco', 'santo andre', 'sao bernardo do campo', 'sao caetano do sul',
  'diadema', 'maua', 'barueri', 'carapicuiba', 'itapecerica da serra', 'embu das artes', 'taboao da serra',
  'cotia', 'itapevi', 'jandira', 'santana de parnaiba', 'franco da rocha', 'caieiras', 'francisco morato',
  'ribeirao pires', 'rio grande da serra', 'mogi das cruzes', 'suzano', 'poa', 'ferraz de vasconcelos',
]);

const SP_LITORAL_CITIES = new Set([
  'santos', 'sao vicente', 'praia grande', 'guaruja', 'cubatao', 'bertioga', 'itaniaem', 'peruibe', 'mongagua',
  'caraguatatuba', 'ubatuba', 'ilhabela', 'sao sebastiao',
]);

const SP_DDD_BY_CITY = {
  'sao paulo': 11,
  'campinas': 19,
  'sorocaba': 15,
  'ribeirao preto': 16,
  'santos': 13,
  'sao jose dos campos': 12,
  'bauru': 14,
  'aracatuba': 18,
  'presidente prudente': 18,
};

export function normalizeGeoText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function inferSpMacroRegion(city) {
  const n = normalizeGeoText(city);
  if (!n) return null;
  if (n === 'sao paulo') return 'Capital';
  if (SP_LITORAL_CITIES.has(n)) return 'Litoral';
  return 'Interior';
}

export const inferMacroRegion = inferSpMacroRegion;

export function inferDddByCity(city) {
  const n = normalizeGeoText(city);
  return SP_DDD_BY_CITY[n] || null;
}

export function detectStatewideOffer(parsed) {
  const text = [
    parsed?.statewide_note,
    parsed?.validity_note,
    parsed?.scope,
    parsed?.store_scope,
    parsed?.raw_text,
    parsed?.store_name,
  ]
    .map((v) => String(v || ''))
    .join(' ')
    .toLowerCase();
  return /(todas\s+as\s+lojas.*estado\s+de\s+s[aã]o\s+paulo|todo\s+o\s+estado\s+de\s+s[aã]o\s+paulo|estadual\s*sp|v[aá]lido\s+no\s+estado\s+de\s+sp)/i.test(text);
}

/**
 * @param {object} params
 * @param {string} params.ingestSource
 * @param {string} params.runId
 * @param {string} params.storeDisplayName
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {string} params.mapCategory
 * @param {NormalizedPromoItem[]} params.items
 * @param {string | null | undefined} [params.storeCnpj]
 * @param {Record<string, unknown>} [params.metadata]
 * @returns {NormalizedPromoRun}
 */
export function createNormalizedPromoRun(params) {
  const storeCnpj = normalizeCnpjDigits(params.storeCnpj ?? null);
  return {
    ingestSource: params.ingestSource,
    runId: params.runId,
    storeDisplayName: params.storeDisplayName.trim(),
    lat: params.lat,
    lng: params.lng,
    mapCategory: params.mapCategory,
    items: params.items,
    storeCnpj: storeCnpj ?? null,
    metadata: params.metadata,
  };
}

/**
 * Corpo típico do GPT em import DIA (após JSON.parse).
 * @param {object} parsed
 * @param {string} [parsed.store_name]
 * @param {Array<{ product_name?: string, promo_price?: unknown, valid_until?: string | null, unit?: string | null, original_price?: unknown, image_url?: string | null }>} [parsed.offers]
 * @param {object} opts
 * @param {number} opts.lat
 * @param {number} opts.lng
 * @param {string} opts.runId
 * @param {string} [opts.storePageUrl]
 * @param {string} [opts.mapCategory]
 * @returns {NormalizedPromoRun | { error: string }}
 */
export function buildDiaGptPromoRun(parsed, opts) {
  const storeDisplayName = String(parsed?.store_name || '').trim();
  if (!storeDisplayName) {
    return { error: 'store_name não foi extraído' };
  }

  const offers = Array.isArray(parsed?.offers) ? parsed.offers : [];
  /** @type {NormalizedPromoItem[]} */
  const items = [];

  for (const o of offers) {
    const productName = String(o?.product_name || '').trim();
    const price =
      typeof o?.promo_price === 'number' ? o.promo_price : parsePriceBR(o?.promo_price);
    if (!productName || price == null || price <= 0) continue;

    let validUntil = o?.valid_until != null ? String(o.valid_until).trim() : null;
    if (validUntil === '') validUntil = null;

    const unit = o?.unit != null ? String(o.unit).trim() : null;
    const originalPrice =
      typeof o?.original_price === 'number' ? o.original_price : parsePriceBR(o?.original_price);
    const imageUrl = o?.image_url != null ? String(o.image_url).trim() : null;
    items.push({
      productName,
      price,
      validUntil,
      unit: unit || null,
      originalPrice: Number.isFinite(originalPrice) ? originalPrice : null,
      imageUrl: imageUrl || null,
    });
  }

  const mapCategory = opts.mapCategory || 'Supermercado - Promoção';
  const metadata = opts.storePageUrl ? { storePageUrl: opts.storePageUrl } : undefined;

  return createNormalizedPromoRun({
    ingestSource: INGEST_SOURCE_DIA_STORE_PAGE,
    runId: opts.runId,
    storeDisplayName,
    lat: opts.lat,
    lng: opts.lng,
    mapCategory,
    items,
    metadata,
  });
}

/**
 * @param {NormalizedPromoRun} run
 * @returns {string | null} mensagem de erro ou null se ok
 */
export function validateNormalizedPromoRun(run) {
  if (!run?.ingestSource) return 'ingestSource obrigatório';
  if (!run.runId) return 'runId obrigatório';
  if (!run.storeDisplayName) return 'storeDisplayName obrigatório';
  if (!Number.isFinite(run.lat) || !Number.isFinite(run.lng)) return 'lat/lng inválidos';
  if (!run.mapCategory) return 'mapCategory obrigatório';
  if (!Array.isArray(run.items)) return 'items deve ser array';
  return null;
}

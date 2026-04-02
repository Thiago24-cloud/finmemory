import { normalizeCnpjDigits } from './cnpj.js';
import { parsePriceBR } from './money.js';

/** @typedef {{ productName: string, price: number, validUntil: string | null }} NormalizedPromoItem */

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
 * @param {Array<{ product_name?: string, promo_price?: unknown, valid_until?: string | null }>} [parsed.offers]
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

    items.push({ productName, price, validUntil });
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

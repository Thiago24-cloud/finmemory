/**
 * Regras map_thumbnail_match_rules (Supabase), cache em memória, invalidação após CRUD no painel.
 */

import { getMapQuickAddSupabase } from './mapQuickAddCore';

function rulesCacheTtlMs() {
  return Math.max(
    5000,
    Number.parseInt(
      typeof process !== 'undefined' ? process.env?.MAP_THUMBNAIL_RULES_CACHE_MS || '45000' : '45000',
      10
    ) || 45000
  );
}

let cache = {
  loadedAt: 0,
  rows: /** @type {any[] | null} */ (null),
  inflight: /** @type {Promise<any[]> | null} */ (null),
};

function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} normProduct — já normalizado (sem acento, lower)
 * @param {string} keyword — keyword crua do painel
 */
export function productKeywordMatches(normProduct, keyword) {
  const kw = normalizeText(keyword);
  if (kw.length < 2) return false;
  if (kw.includes(' ')) return normProduct.includes(kw);
  const body = escapeRegExp(kw);
  // "shake" também casa "shakes" (plural em cardápio); não acrescentar s? se o keyword já termina em s
  const allowOptionalPlural = kw.length >= 4 && !/s$/i.test(kw);
  const re = allowOptionalPlural
    ? new RegExp(`\\b${body}s?\\b`, 'i')
    : new RegExp(`\\b${body}\\b`, 'i');
  return re.test(normProduct);
}

/**
 * @param {string} productRaw
 * @param {'fast_food' | 'supermarket' | 'generic'} retailCtx
 * @param {boolean} supermarketProductHint
 * @param {Array<{ canonical_label: string, keywords: string[], retail_context: string, active?: boolean }>} rules
 * @returns {string[]}
 */
export function ruleRowMatchesProduct(normProduct, productRaw, retailCtx, supermarketProductHint, row) {
  if (row.active === false) return false;
  const fastFoodProduct =
    retailCtx === 'fast_food' ||
    /\b(bk|whopper|mcdonald|mcflurry|big\s*mac)\b/i.test(productRaw);
  const rc = String(row.retail_context || 'supermarket').toLowerCase();
  if (rc === 'supermarket' && !supermarketProductHint) return false;
  if (rc === 'fast_food' && !fastFoodProduct) return false;
  const kws = Array.isArray(row.keywords) ? row.keywords : [];
  if (!kws.length) return false;
  return kws.some((k) => productKeywordMatches(normProduct, String(k || '')));
}

export function collectCanonicalsFromDbRules(productRaw, retailCtx, supermarketProductHint, rules) {
  if (!Array.isArray(rules) || !rules.length) return [];
  const norm = normalizeText(productRaw);
  if (!norm) return [];

  const out = [];
  for (const row of rules) {
    if (!ruleRowMatchesProduct(norm, productRaw, retailCtx, supermarketProductHint, row)) continue;
    const label = String(row.canonical_label || '').trim();
    if (label) out.push(label);
  }
  return out;
}

/** Regras que casam o produto, na mesma ordem do painel (sort_order, id). */
export function listMatchingThumbnailRules(productRaw, retailCtx, supermarketProductHint, rules) {
  const norm = normalizeText(productRaw);
  if (!norm || !Array.isArray(rules) || !rules.length) return [];
  return rules.filter((row) => ruleRowMatchesProduct(norm, productRaw, retailCtx, supermarketProductHint, row));
}

/**
 * Primeira regra com URL http(s) explícita (sem base64 — mapa usa só links).
 * @param {string} productRaw
 * @param {'fast_food' | 'supermarket' | 'generic'} retailCtx
 * @param {boolean} supermarketProductHint
 * @param {Array<{ image_url?: string | null }>} rules — lista já ordenada
 * @returns {string | null}
 */
export function getFirstRuleDirectImageUrl(productRaw, retailCtx, supermarketProductHint, rules) {
  if (!Array.isArray(rules) || !rules.length) return null;
  const norm = normalizeText(productRaw);
  if (!norm) return null;

  for (const row of rules) {
    if (!ruleRowMatchesProduct(norm, productRaw, retailCtx, supermarketProductHint, row)) continue;
    const u = String(row.image_url || '').trim();
    if (!u || u.length > 2048) continue;
    if (/^https?:\/\//i.test(u)) return u;
  }
  return null;
}

export async function getThumbnailMatchRulesCached() {
  const now = Date.now();
  if (cache.rows && now - cache.loadedAt < rulesCacheTtlMs()) {
    return cache.rows;
  }
  if (cache.inflight) return cache.inflight;

  cache.inflight = (async () => {
    const supabase = getMapQuickAddSupabase();
    if (!supabase) {
      cache.rows = [];
      cache.loadedAt = Date.now();
      cache.inflight = null;
      return [];
    }
    const { data, error } = await supabase
      .from('map_thumbnail_match_rules')
      .select('id, canonical_label, keywords, retail_context, sort_order, active, notes, image_url')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) {
      console.warn('map_thumbnail_match_rules:', error.message);
      cache.rows = [];
    } else {
      cache.rows = data || [];
    }
    cache.loadedAt = Date.now();
    cache.inflight = null;
    return cache.rows;
  })();

  return cache.inflight;
}

export function invalidateThumbnailMatchRulesCache() {
  cache = { loadedAt: 0, rows: null, inflight: null };
}

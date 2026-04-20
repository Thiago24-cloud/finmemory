/** Open Food Facts exige User-Agent identificável: https://openfoodfacts.github.io/openfoodfacts-server/api/ */
const OFF_USER_AGENT = 'FinMemory/1.0 (https://finmemory.com.br; mapa preços)';

import {
  buildThumbnailImagePlanAsync,
  inferRetailContext,
  inferSupermarketProductHint,
  normProductImageKey,
} from './mapProductImageSearchPlan';
import { getThumbnailMatchRulesCached, listMatchingThumbnailRules } from './mapThumbnailMatchRules';
import { getMapQuickAddSupabase } from './mapQuickAddCore';
import { validateMapProductImageUrl, visionEnabled } from './validateMapProductImageVision';

function isLikelyImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim().toLowerCase();
  if (!/^https?:\/\//.test(u)) return false;
  if (/\.(jpg|jpeg|png|webp|gif|avif|svg)(\?|#|$|&)/i.test(u)) return true;
  if (/images\.openfoodfacts\.org|googleusercontent|gstatic|cdn|cloudfront|imgix|cloudinary/i.test(u)) {
    return true;
  }
  return false;
}

function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildLegacySearchTerms(name, storeName) {
  const base = normalizeText(name).split(' ').slice(0, 10).join(' ');
  const store = normalizeText(storeName).split(' ').slice(0, 4).join(' ');
  return `${base} ${store} produto comida`.trim();
}

/**
 * Rejeita hosts/caminhos típicos de suplementos, whey, etc. (evita "shake" → HiPRO).
 */
export function isBlockedThumbnailImageUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (/^data:image\//i.test(trimmed)) return false;
  let u;
  try {
    u = new URL(trimmed);
  } catch {
    return true;
  }
  const host = u.hostname.toLowerCase();
  const path = `${u.pathname} ${u.search}`.toLowerCase();

  const badHost =
    /hi-?pro|hipro|myprotein|growthsupp|integralmedica|maxtitanium|darkness|bodyaction|probiotica|blackskull|underlabz|puravida|centralnutri|nutri.?city|netshoes|decathlon/i.test(
      host
    );
  if (badHost) return true;

  const badPath =
    /\b(whey|isolad|creatin|bcaa|pre[-\s]?workout|suplement|prote[ií]na\s*(em\s*)?p[oó]|hi[-\s]?pro|gainerv|massa\s*muscular)\b/i.test(
      path
    );
  if (badPath) return true;

  return false;
}

function pickOffImageFromProduct(p) {
  return (
    p?.image_front_small_url ||
    p?.image_front_url ||
    p?.image_url ||
    null
  );
}

function scoreNameMatch(productName, wantedNorm) {
  const pn = normalizeText(productName).toLowerCase();
  if (!pn || !wantedNorm) return 0;
  const wa = wantedNorm.split(/\s+/).filter((w) => w.length > 2);
  let score = 0;
  for (const w of wa) {
    if (pn.includes(w)) score += 1;
  }
  return score;
}

async function fetchOpenFoodFactsSearchOnce(searchTerms) {
  const terms = normalizeText(searchTerms);
  if (!terms || terms.length < 2) return [];

  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', terms);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '12');
  url.searchParams.set(
    'fields',
    'product_name,brands,image_front_url,image_url,image_front_small_url'
  );

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': OFF_USER_AGENT,
    },
  });
  if (!res.ok) return [];
  const payload = await res.json();
  return Array.isArray(payload?.products) ? payload.products : [];
}

function bestImageFromProducts(products, wantedNorm) {
  if (!products.length) return null;

  const scored = [];
  for (const p of products) {
    const candidate = pickOffImageFromProduct(p);
    if (!candidate || !isLikelyImageUrl(candidate) || isBlockedThumbnailImageUrl(candidate)) continue;
    const name = String(p?.product_name || '');
    const sc = scoreNameMatch(name, wantedNorm);
    scored.push({ candidate, sc });
  }
  scored.sort((a, b) => b.sc - a.sc);
  if (scored.length && scored[0].sc > 0) return scored[0].candidate;

  for (const p of products) {
    const candidate = pickOffImageFromProduct(p);
    if (candidate && isLikelyImageUrl(candidate) && !isBlockedThumbnailImageUrl(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Busca imagem no Open Food Facts pelo nome do produto (gratuito).
 * @param {{ skip?: boolean, queryOverride?: string|null }} [opts]
 */
export async function fetchOpenFoodFactsImageByName(name, opts = {}) {
  if (opts.skip) return null;

  const full = normalizeText(opts.queryOverride != null ? opts.queryOverride : name);
  if (!full || full.length < 3) return null;
  const wantedNorm = full.toLowerCase();

  const variants = [full];
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length > 6) variants.push(parts.slice(0, 6).join(' '));
  if (parts.length > 4) variants.push(parts.slice(0, 4).join(' '));
  if (parts.length > 2) variants.push(parts.slice(0, 3).join(' '));

  const tried = new Set();
  for (const v of variants) {
    const key = v.trim().toLowerCase();
    if (tried.has(key) || key.length < 3) continue;
    tried.add(key);
    try {
      const products = await fetchOpenFoodFactsSearchOnce(v);
      const img = bestImageFromProducts(products, wantedNorm);
      if (img) return img;
    } catch {
      /* rede / timeout */
    }
  }
  return null;
}

/** Remove caracteres de controlo e limita tamanho — evita 400 "invalid argument" na API. */
function sanitizeGoogleCseQuery(raw, maxLen = 2048) {
  let s = String(raw || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  return s;
}

function googleApiErrorFromPayload(payload, resStatus, resStatusText) {
  const err = payload?.error || {};
  const reasons = Array.isArray(err.errors)
    ? err.errors.map((e) => e?.reason || e?.message).filter(Boolean)
    : [];
  const reasonSuffix = reasons.length ? ` — ${reasons.join('; ')}` : '';
  return {
    code: err.code != null ? Number(err.code) : undefined,
    message: String(err.message || resStatusText || 'Erro na API Google Custom Search') + reasonSuffix,
    status: err.status,
    httpStatus: resStatus,
  };
}

/** Resultados de busca web (sem searchType=image): extrai URL de imagem do pagemap. */
function pickImageUrlFromWebCseItem(it) {
  const pm = it?.pagemap;
  if (pm && typeof pm === 'object') {
    const cseImg = pm.cse_image;
    if (Array.isArray(cseImg)) {
      for (const x of cseImg) {
        const src = x?.src;
        if (src && typeof src === 'string' && /^https?:\/\//i.test(src.trim())) return src.trim();
      }
    }
    const meta = pm.metatags;
    if (Array.isArray(meta)) {
      for (const m of meta) {
        if (!m || typeof m !== 'object') continue;
        const og = m['og:image'] || m['og:image:url'] || m['twitter:image'] || m['twitter:image:src'];
        if (og && typeof og === 'string' && /^https?:\/\//i.test(og.trim())) return og.trim();
      }
    }
  }
  const link = it?.link;
  if (link && typeof link === 'string' && /^https:\/\//i.test(link.trim())) {
    const t = link.trim();
    if (isLikelyImageUrl(t)) return t;
  }
  return null;
}

function mapWebCseItemsToImageShape(items) {
  const out = [];
  for (const it of items || []) {
    const u = pickImageUrlFromWebCseItem(it);
    if (u) out.push({ link: u });
  }
  return out;
}

/**
 * Chamada bruta à Custom Search API (imagem ou web).
 * @param {boolean} imageSearch — se false, omite searchType (útil quando o cx não suporta image ou devolve 400).
 */
async function fetchGoogleCseRawDetailed(query, imageSearch) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) {
    return {
      ok: false,
      status: 0,
      items: [],
      googleError: { message: 'GOOGLE_API_KEY ou GOOGLE_CSE_ID não configurados' },
    };
  }

  const q = sanitizeGoogleCseQuery(query);
  if (!q || q.length < 2) {
    return { ok: false, status: 0, items: [], googleError: { message: 'Query de busca vazia' } };
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cseId);
  url.searchParams.set('q', q);
  if (imageSearch) url.searchParams.set('searchType', 'image');
  url.searchParams.set('safe', 'active');
  url.searchParams.set('num', '8');
  url.searchParams.set('gl', 'br');
  url.searchParams.set('hl', 'pt-BR');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  let payload = {};
  try {
    payload = await res.json();
  } catch {
    payload = {};
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      items: [],
      googleError: googleApiErrorFromPayload(payload, res.status, res.statusText),
    };
  }

  return {
    ok: true,
    status: res.status,
    items: Array.isArray(payload?.items) ? payload.items : [],
    googleError: null,
  };
}

/**
 * Busca tipo imagem, com fallback para busca web no mesmo cx (muitos 400 "invalid argument" =
 * motor sem image search ou parâmetros rejeitados).
 */
async function fetchGoogleCseImageSearchDetailed(query) {
  const q = sanitizeGoogleCseQuery(query);
  if (!q || q.length < 2) {
    return { ok: false, status: 0, items: [], googleError: { message: 'Query de busca vazia' } };
  }

  const img = await fetchGoogleCseRawDetailed(q, true);
  if (img.ok && Array.isArray(img.items) && img.items.length > 0) {
    return img;
  }

  const tryWeb =
    (!img.ok && img.status === 400) ||
    (img.ok && (!img.items || img.items.length === 0));

  if (tryWeb) {
    const web = await fetchGoogleCseRawDetailed(q, false);
    if (web.ok) {
      const mapped = mapWebCseItemsToImageShape(web.items);
      if (mapped.length > 0) {
        return {
          ok: true,
          status: 200,
          items: mapped,
          googleError: null,
        };
      }
    }
    if (!img.ok && img.status === 400 && !web.ok) {
      return {
        ok: false,
        status: web.status || img.status,
        items: [],
        googleError: web.googleError || img.googleError,
      };
    }
  }

  return img;
}

async function fetchGoogleCseImageOnce(query) {
  const r = await fetchGoogleCseImageSearchDetailed(query);
  if (!r.ok) return null;
  return r.items;
}

function collectCseImageLinks(items, max, seen) {
  const out = [];
  const set = seen || new Set();
  for (const it of items || []) {
    const link = it?.link || null;
    if (!link || typeof link !== 'string') continue;
    const t = link.trim();
    if (!/^https:\/\//i.test(t)) continue;
    if (!isLikelyImageUrl(t) || isBlockedThumbnailImageUrl(t)) continue;
    const dedupeKey = t.split('?')[0];
    if (set.has(dedupeKey)) continue;
    set.add(dedupeKey);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Termo **apenas** para pedidos ao Google CSE. Não substitui o nome no catálogo/mapa:
 * gramagens e medidas saem da *query* (fotos 90g vs 180g são quase iguais), mas o rótulo
 * completo continua na BD e na UI — ver curador com `extractProductSpecHintsForDisplay`.
 * @param {string} raw nome completo como na base de dados
 * @returns {string}
 */
export function getCleanSearchTerm(raw) {
  return simplifyProductNameForImageSearch(raw);
}

/**
 * Implementação de `getCleanSearchTerm` — limpa rótulos de PDV antes do Google CSE.
 */
export function simplifyProductNameForImageSearch(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  const noise = [
    /\bPREÇO\s+ESPECIAL\b/gi,
    /\bPROMO(C[AÂÃ]O|Ç[AÂÃ]O)?\b/gi,
    /\bOFERTA\b/gi,
    /\bLEVE\s+\d+\s+PAGUE\s+\d+\b/gi,
    /\bCAIXA\s+\d+\s*G\b/gi,
    /\bFRASCO\s+\d+\s*(ML|L|LT)\b/gi,
    /\bEMBALAGEM\s+\d+\s*G?\b/gi,
    /\bPCT\.?\s*\d+[,.]?\d*\s*(KG|G)\b/gi,
    /\bSACH[EÊ]\s+\d+\s*G\b/gi,
    /\bTRIPLA\s+A[CÇ]O\b/gi,
    /\bCAIXA\b/gi,
    /\bFRASCO\b/gi,
    /\bEMBALAGEM\b/gi,
    /\bTAMANHO\s+FAMILIA\b/gi,
    /\bECON(Ô|O)MICO\b/gi,
    /\b\d+[,.]?\d*\s*(G|KG|GR|ML|L|LT|LTS)\b/gi,
    /\b\d+\s*X\s*\d+\s*(G|ML|L)\b/gi,
  ];
  for (const re of noise) s = s.replace(re, ' ');
  s = normalizeText(s);
  s = s.replace(/\bL\s+OREAL\b/gi, 'LOREAL');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\b\d{8,14}\b/g, ' ');
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length > 8) s = parts.slice(0, 8).join(' ');
  return s.slice(0, 72).trim();
}

/** Primeiras N palavras — fallback quando a API devolve 400 ou nome longo não rende URLs. */
export function firstWordsProductQuery(text, n = 3) {
  const parts = String(text || '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (!parts.length) return '';
  return parts.slice(0, Math.max(1, n)).join(' ').trim();
}

function isGoogleCseBadRequestError(err) {
  if (!err || typeof err !== 'object') return false;
  if (Number(err.httpStatus) === 400) return true;
  const m = String(err.message || '');
  return /\b400\b|badRequest|invalid argument/i.test(m);
}

/**
 * Curadoria: CSE imagem — 1ª tentativa "… fundo branco png", 2ª só nome (curto); devolve erro Google quando houver.
 * @param {string} productName
 * @param {{ max?: number }} [opts]
 * @returns {Promise<{ urls: string[], googleError: object|null, queries_tried: string[] }>}
 */
export async function fetchGoogleCseCuratorCandidates(productName, opts = {}) {
  const max = Math.min(10, Math.max(1, Number(opts?.max) || 3));
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) {
    return {
      urls: [],
      googleError: { message: 'GOOGLE_API_KEY ou GOOGLE_CSE_ID não configurados' },
      queries_tried: [],
    };
  }

  const simplified =
    getCleanSearchTerm(productName) ||
    normalizeText(productName).replace(/\s+/g, ' ').trim().slice(0, 72);
  if (simplified.length < 2) {
    return { urls: [], googleError: null, queries_tried: [] };
  }

  const queries_tried = [];
  const seen = new Set();
  let urls = [];
  let googleError = null;

  async function tryQuery(q) {
    const trimmed = sanitizeGoogleCseQuery(String(q || '').trim());
    if (trimmed.length < 2 || queries_tried.includes(trimmed)) return;
    queries_tried.push(trimmed);
    const r = await fetchGoogleCseImageSearchDetailed(trimmed);
    if (!r.ok) {
      if (!googleError) googleError = r.googleError;
      return;
    }
    const more = collectCseImageLinks(r.items, max - urls.length, seen);
    urls = urls.concat(more);
    if (more.length > 0) googleError = null;
  }

  const suffix = ' fundo branco png';
  await tryQuery(`${simplified}${suffix}`);
  if (urls.length < max) await tryQuery(simplified.slice(0, 100));

  const mini = firstWordsProductQuery(simplified, 3);
  const longLabel = simplified.length > 48;
  const needMiniFallback =
    urls.length === 0 &&
    mini.length >= 2 &&
    mini.length < simplified.length &&
    (isGoogleCseBadRequestError(googleError) || longLabel);

  if (needMiniFallback) {
    await tryQuery(`${mini}${suffix}`);
    if (urls.length < max) await tryQuery(mini);
  }

  if (urls.length === 0 && !googleError && queries_tried.length) {
    googleError = {
      message: 'Nenhuma imagem HTTPS válida após as tentativas de busca.',
      httpStatus: undefined,
    };
  }

  return { urls: urls.slice(0, max), googleError, queries_tried };
}

/**
 * @deprecated Preferir fetchGoogleCseCuratorCandidates (inclui fallback + metadados de erro).
 * @returns {Promise<string[]>}
 */
export async function fetchGoogleCseWhiteBackgroundCandidates(productName, opts = {}) {
  const { urls } = await fetchGoogleCseCuratorCandidates(productName, opts);
  return urls;
}

/**
 * @param {string} name
 * @param {string} storeName
 * @param {{ productLabelForVision?: string, queries?: string[] }} [opts]
 */
export async function fetchGoogleCseImageByName(name, storeName, opts = {}) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) return null;

  const plan =
    Array.isArray(opts.queries) && opts.queries.length
      ? { googleQueries: opts.queries }
      : await buildThumbnailImagePlanAsync(name, storeName);

  const queries =
    plan.googleQueries?.length > 0
      ? plan.googleQueries
      : [buildLegacySearchTerms(name, storeName)].filter(Boolean);

  const visionLabel = opts.productLabelForVision || name;
  const useVision = visionEnabled();

  for (const q of queries) {
    let items;
    try {
      items = await fetchGoogleCseImageOnce(q);
    } catch {
      items = null;
    }
    if (!items || !items.length) continue;

    for (const it of items) {
      const link = it?.link || null;
      if (!link || !isLikelyImageUrl(link) || isBlockedThumbnailImageUrl(link)) continue;
      if (useVision) {
        const ok = await validateMapProductImageUrl(link, visionLabel);
        if (!ok) continue;
      }
      return link;
    }
  }

  return null;
}

/**
 * Open Food Facts → Google CSE (sem regra do painel nem cache map_product_image_cache).
 */
export async function resolveThumbnailFromExternalApisOnly(name, storeName, useGoogleCse) {
  const plan = await buildThumbnailImagePlanAsync(name, storeName);

  let url = await fetchOpenFoodFactsImageByName(name, {
    skip: plan.skipOpenFoodFacts,
    queryOverride: plan.openFoodFactsQuery,
  });
  let src = 'openfoodfacts';

  if (!url && useGoogleCse) {
    url = await fetchGoogleCseImageByName(name, storeName, {
      queries: plan.googleQueries,
      productLabelForVision: name,
    });
    src = 'google_cse';
  }

  if (!url) return { url: null, source: null };
  if (isBlockedThumbnailImageUrl(url)) return { url: null, source: null };
  return { url, source: src };
}

const THUMB_RULE_DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,/i;

/** Texto curto no campo miniatura = chave do repositório map_product_image_cache (troca ao atualizar o repo). */
function looksLikeRepertoireLabel(s) {
  const t = String(s || '').trim();
  if (!t || t.length > 200) return false;
  if (/^data:/i.test(t) || /:\/\//.test(t)) return false;
  if (/[\n\r]/.test(t)) return false;
  return /^[\p{L}\p{N}\s'.&\-–—]+$/u.test(t);
}

async function fetchRepertoireImageUrl(supabase, label) {
  const normKey = normProductImageKey(label);
  if (!supabase || normKey.length < 2) return null;
  const { data, error } = await supabase
    .from('map_product_image_cache')
    .select('image_url')
    .eq('norm_key', normKey)
    .maybeSingle();
  if (error || !data?.image_url) return null;
  const u = String(data.image_url).trim();
  if (!isLikelyImageUrl(u) || isBlockedThumbnailImageUrl(u)) return null;
  return u;
}

/**
 * Por regra (ordem do painel): https → data URL → texto = rótulo no repositório → miniatura vazia + canonical_label no repositório.
 */
async function resolveThumbnailRuleRowImage(row, supabase) {
  const raw = String(row.image_url || '').trim();
  const canonical = String(row.canonical_label || '').trim();

  if (!raw) {
    return fetchRepertoireImageUrl(supabase, canonical);
  }

  if (/^https?:\/\//i.test(raw)) {
    if (raw.length > 2048) return null;
    if (isLikelyImageUrl(raw) && !isBlockedThumbnailImageUrl(raw)) return raw;
    return null;
  }

  // Base64 na regra não vai para o mapa (pesado); tenta a mesma imagem pelo repositório (rótulo).
  if (THUMB_RULE_DATA_URL_RE.test(raw)) {
    return fetchRepertoireImageUrl(supabase, canonical);
  }

  if (looksLikeRepertoireLabel(raw)) {
    const hit = await fetchRepertoireImageUrl(supabase, raw);
    if (hit) return hit;
  }

  return null;
}

/**
 * Imagem da primeira regra que casa: URL, base64, chave do repositório ou só rótulo (canonical) no repositório.
 */
export async function findDirectThumbnailRuleImageUrl(productName, storeName) {
  const product = String(productName || '').trim();
  if (!product) return null;
  let rules = [];
  try {
    rules = await getThumbnailMatchRulesCached();
  } catch {
    return null;
  }
  if (!Array.isArray(rules) || !rules.length) return null;
  const ctx = inferRetailContext(String(storeName || '').trim());
  const hint = inferSupermarketProductHint(product, ctx);
  const supabase = getMapQuickAddSupabase();
  const matching = listMatchingThumbnailRules(product, ctx, hint, rules);
  for (const row of matching) {
    const resolved = await resolveThumbnailRuleRowImage(row, supabase);
    if (resolved && isValidResolvedImage(resolved)) return resolved;
  }
  return null;
}

/**
 * Resolve OFF → CSE com o mesmo plano (queries contextuais, skip OFF em fast food quando aplicável).
 * 1º regra do painel com image_url; 2º/3º OFF e CSE.
 */
export async function fetchExternalProductImageResolved(name, storeName, useGoogleCse) {
  const direct = await findDirectThumbnailRuleImageUrl(name, storeName);
  if (direct) return { url: direct, source: 'thumbnail_rule' };
  return resolveThumbnailFromExternalApisOnly(name, storeName, useGoogleCse);
}

export function isValidResolvedImage(url) {
  if (!url || typeof url !== 'string') return false;
  const t = url.trim();
  if (/^data:/i.test(t)) return false;
  return isLikelyImageUrl(t) && !isBlockedThumbnailImageUrl(t);
}

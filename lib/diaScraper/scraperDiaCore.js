import { parsePriceBR } from '../ingest/money.js';
import {
  SP_GRANDE_SP_CITIES,
  inferDddByCity,
  inferMacroRegion,
  normalizeGeoText,
} from '../ingest/run.js';
import { geocodeAddress } from '../geocode.js';
import { splitProdutosByPublishReadiness } from '../promoQueueProcessing.js';

export const SCRAPER_DIA_ORIGEM = 'scraper_dia';
export const SCRAPER_DIA_PRICE_SOURCE = 'scraper_dia';
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
export const DIA_VISION_BATCH_SIZE = 15;

const DIA_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** @returns {string} YYYY-MM-DD (America/Sao_Paulo) */
export function nextSundayYmdBrazil(from = new Date()) {
  const tz = 'America/Sao_Paulo';
  const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  const ymdFmt = new Intl.DateTimeFormat('fr-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const base = from.getTime();
  for (let i = 0; i < 14; i++) {
    const d = new Date(base + i * 86400000);
    if (weekdayFmt.format(d) === 'Sun') return ymdFmt.format(d);
  }
  return ymdFmt.format(new Date(base));
}

export function extractJsonObject(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
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
    const y = m[3];
    const mo = m[2].padStart(2, '0');
    const da = m[1].padStart(2, '0');
    const iso = `${y}-${mo}-${da}`;
    const d = new Date(`${iso}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  return null;
}

/**
 * Fetches the Gatsby page-data.json for a DIA store URL.
 * Avoids Puppeteer — the JSON is publicly served by the Gatsby SSG build.
 * @param {string} storeUrl  e.g. https://www.dia.com.br/lojas/sp-sao-paulo-pinheiros-rua-fradique-coutinho-1256/
 */
export async function fetchDiaPageDataJson(storeUrl) {
  const u = new URL(storeUrl);
  // u.pathname is like "/lojas/sp-.../", so page-data URL becomes:
  // https://www.dia.com.br/page-data/lojas/sp-.../page-data.json
  const pageDataUrl = `https://www.dia.com.br/page-data${u.pathname}page-data.json`;
  const res = await fetch(pageDataUrl, { headers: { 'User-Agent': DIA_UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`page-data.json HTTP ${res.status} para ${storeUrl}`);
  return res.json();
}

/**
 * Downloads an image URL and returns it as base64.
 * @param {string} url
 * @returns {Promise<{base64: string, mediaType: string}>}
 */
export async function fetchImageAsBase64(url) {
  const res = await fetch(url, { headers: { 'User-Agent': DIA_UA } });
  if (!res.ok) throw new Error(`Image HTTP ${res.status} for ${url}`);
  const buf = await res.arrayBuffer();
  const ct = res.headers.get('content-type') || 'image/png';
  return { base64: Buffer.from(buf).toString('base64'), mediaType: ct.split(';')[0].trim() };
}

/**
 * Sends one batch of offer card images to Haiku vision and returns raw ofertas array.
 * @param {string} apiKey
 * @param {string[]} imageUrls  up to DIA_VISION_BATCH_SIZE URLs
 * @param {string|null} finishDateIso  YYYY-MM-DD
 * @returns {Promise<Array<{nome:string,preco:number|null,unidade:string,valid_until:string|null}>>}
 */
async function callVisionBatch(apiKey, imageUrls, finishDateIso) {
  const downloaded = await Promise.all(
    imageUrls.map((url) =>
      fetchImageAsBase64(url).catch((e) => {
        console.warn('[scraper-dia] falha ao baixar imagem:', url, e.message);
        return null;
      })
    )
  );
  const valid = downloaded.filter(Boolean);
  if (valid.length === 0) return [];

  const content = [];
  valid.forEach((img, i) => {
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
    content.push({ type: 'text', text: `[Imagem ${i + 1}]` });
  });
  content.push({
    type: 'text',
    text: `Você analisa cartões de oferta do Supermercado DIA (Brasil).
Para cada uma das ${valid.length} imagens acima, extraia:
- "nome": nome do produto (ex: "Alface-Crespa")
- "preco": número decimal com o preço "Por" / promocional em destaque (ex: 2.99). Se não visível, null.
- "unidade": embalagem/quantidade visível no cartão (ex: "1 un.", "500g"). Se não visível, "".
- "valid_until": "${finishDateIso || ''}"

Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON:
{"ofertas":[{"nome":"...","preco":2.99,"unidade":"1 un.","valid_until":"${finishDateIso || ''}"}]}
Deve ter exatamente ${valid.length} itens na array, na mesma ordem das imagens.`,
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const block = Array.isArray(data?.content) ? data.content.find((b) => b.type === 'text') : null;
  const rawText = block?.text || '';
  if (!rawText) throw new Error('Resposta Anthropic sem texto');

  const jsonStr = extractJsonObject(rawText);
  if (!jsonStr) throw new Error('JSON não encontrado na resposta Haiku vision');
  const parsed = JSON.parse(jsonStr);
  return Array.isArray(parsed?.ofertas) ? parsed.ofertas : [];
}

/**
 * Extracts all offers from a list of image URLs using Haiku vision, batched.
 * @param {string} apiKey
 * @param {string[]} allImageUrls
 * @param {string|null} finishDateIso
 * @returns {Promise<Array>}
 */
export async function extractOffersViaVision(apiKey, allImageUrls, finishDateIso) {
  const allOfertas = [];
  for (let i = 0; i < allImageUrls.length; i += DIA_VISION_BATCH_SIZE) {
    const batch = allImageUrls.slice(i, i + DIA_VISION_BATCH_SIZE);
    const ofertas = await callVisionBatch(apiKey, batch, finishDateIso);
    allOfertas.push(...ofertas);
  }
  return allOfertas;
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
export async function resolveStoreLatLng(store) {
  const q = `Supermercado Dia, ${store.addressForGeocode}, Brasil`;
  const coords = await geocodeAddress(q);
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    return { lat: coords.lat, lng: coords.lng };
  }
  return { lat: null, lng: null };
}

/**
 * Converte ofertas brutas do modelo em produtos da fila (nome, preco, unidade, valid_until).
 * @param {Array<{ nome?: string, preco?: unknown, unidade?: string | null, valid_until?: string | null }>} ofertas
 */
export function mapOfertasToProdutosFila(ofertas, sundayFallbackYmd) {
  const list = Array.isArray(ofertas) ? ofertas : [];
  /** @type {object[]} */
  const out = [];
  for (const o of list) {
    const nome = String(o?.nome || '').trim();
    const precoNum = parsePriceBR(o?.preco);
    const unidade = o?.unidade != null ? String(o.unidade).trim() : '';
    let validUntil = toIsoDateOnly(o?.valid_until);
    if (!validUntil) validUntil = sundayFallbackYmd;

    if (!nome) continue;

    out.push({
      nome,
      preco: precoNum != null && Number.isFinite(precoNum) ? precoNum : null,
      unidade: unidade || null,
      valid_until: validUntil,
      metadata: {
        extraction_strategy: 'scraper_dia_haiku_vision',
        source: SCRAPER_DIA_ORIGEM,
      },
    });
  }
  return out;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} filaRow shape of bot_promocoes_fila row fields needed + produtos array
 * @param {string} ownerUserId
 */
export async function insertApprovedFilaAndPublishScraperDia(supabase, filaRow, ownerUserId) {
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
      origem: SCRAPER_DIA_ORIGEM,
      status: 'aprovado',
      reviewed_at: now,
      reviewed_by: 'api/scraper/dia',
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
      note: 'Fila gravada; nenhum produto com preço válido para o mapa',
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
    Math.min(parseInt(String(process.env.SCRAPER_DIA_REPLACE_HOURS || '24'), 10) || 24, 168)
  );
  const cutoffIso = new Date(Date.now() - defaultTtlHours * 60 * 60 * 1000).toISOString();
  const { error: delErr } = await supabase
    .from('price_points')
    .delete()
    .eq('store_name', store_name)
    .eq('source', SCRAPER_DIA_PRICE_SOURCE)
    .gte('created_at', cutoffIso)
    .ilike('category', '%promo%');

  if (delErr) {
    return { ok: false, step: 'price_points_delete', error: delErr.message, filaId: insertedFila?.id };
  }

  const rows = split.ready.map((p) => {
    const originalPrice = Number(p?.raw?.original_price ?? p?.raw?.preco_de);
    const discountPercent =
      Number.isFinite(originalPrice) && originalPrice > 0 && Number(p.price) > 0 && Number(p.price) < originalPrice
        ? Number((((originalPrice - Number(p.price)) / originalPrice) * 100).toFixed(2))
        : null;

    const locCity = locality_city || p?.raw?.locality_city || null;
    const statewide = Boolean(is_statewide);
    const expiresAt =
      toIsoDateOnly(p.valid_until || p?.raw?.valid_until || p?.raw?.validade) || null;

    return {
      user_id: ownerUserId,
      store_name,
      lat: store_lat,
      lng: store_lng,
      product_name: p.name,
      price: Number(p.price),
      image_url: p.image_url || null,
      category: 'Supermercado - Promoção',
      source: SCRAPER_DIA_PRICE_SOURCE,
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

  return {
    ok: true,
    filaId: insertedFila?.id,
    inserted: rows.length,
    offersTotal: Array.isArray(produtos) ? produtos.length : 0,
    invalidPrice: split.invalid.length,
  };
}

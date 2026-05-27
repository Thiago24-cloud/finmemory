import { detectStatewideOffer, normalizeGeoText } from '../run.js';

const PRODUCT_NAME_KEYS = ['product_name', 'name', 'title', 'produto', 'descricao', 'description'];
const PRICE_KEYS = ['current_price', 'price', 'preco', 'promo_price', 'sale_price', 'offer_price'];
const ORIGINAL_PRICE_KEYS = ['original_price', 'price_from', 'preco_de', 'old_price', 'list_price'];
const IMAGE_KEYS = ['image_url', 'image', 'img', 'thumbnail', 'photo', 'foto'];
const DATE_KEYS = ['expiry_date', 'valid_until', 'validade', 'expires_at', 'date_end'];
const UNIT_KEYS = ['unit', 'unidade', 'measure', 'medida'];

function pickFirst(obj, keys) {
  for (const key of keys) {
    if (obj?.[key] != null && obj[key] !== '') return obj[key];
  }
  return null;
}

function toNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value)
    .replace(/R\$\s*/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toHttpUrl(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
}

function parseJsonSafe(value) {
  if (value == null) return null;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function* walkObjects(input, depth = 0) {
  if (depth > 8 || input == null) return;
  if (Array.isArray(input)) {
    for (const item of input) yield* walkObjects(item, depth + 1);
    return;
  }
  if (typeof input !== 'object') return;
  yield input;
  for (const value of Object.values(input)) {
    yield* walkObjects(value, depth + 1);
  }
}

function extractFromObjectCandidate(obj, strategy = 'parsed_object') {
  const name = pickFirst(obj, PRODUCT_NAME_KEYS);
  const price = toNumber(pickFirst(obj, PRICE_KEYS));
  const imageUrl = toHttpUrl(pickFirst(obj, IMAGE_KEYS));
  const originalPrice = toNumber(pickFirst(obj, ORIGINAL_PRICE_KEYS));
  const expiryDate = pickFirst(obj, DATE_KEYS);
  const unit = pickFirst(obj, UNIT_KEYS);
  if (!name && !price && !imageUrl) return null;
  return {
    product_name: name ? String(name).trim() : '',
    current_price: price,
    original_price: originalPrice,
    unit: unit ? String(unit).trim() : null,
    expiry_date: expiryDate ? String(expiryDate).trim() : null,
    image_url: imageUrl,
    extraction_strategy: strategy,
  };
}

function extractFromHtmlText(text) {
  const html = String(text || '');
  if (!html) return [];
  const products = [];
  const productRegex = /(?:produto|product)[^<>{}]{0,40}[:=]\s*["']([^"']{3,140})["'][\s\S]{0,250}?(?:pre[cç]o|price)[^<>{}]{0,40}[:=]\s*["']?([\d.,]{2,12})["']?[\s\S]{0,300}?(?:https?:\/\/[^"'\s>]+\.(?:png|jpe?g|webp))/gi;
  let m;
  while ((m = productRegex.exec(html)) && products.length < 200) {
    products.push({
      product_name: String(m[1] || '').trim(),
      current_price: toNumber(m[2]),
      original_price: null,
      unit: null,
      expiry_date: null,
      image_url: toHttpUrl(m[3]),
      extraction_strategy: 'html_regex',
    });
  }
  return products;
}

function extractJsonScriptBlocks(html, scriptTypeRegex) {
  const text = String(html || '');
  if (!text) return [];
  const blocks = [];
  const re = new RegExp(
    `<script[^>]*type=["']${scriptTypeRegex}["'][^>]*>([\\s\\S]*?)<\\/script>`,
    'gi'
  );
  let match;
  while ((match = re.exec(text))) {
    const raw = String(match[1] || '').trim();
    if (!raw) continue;
    const parsed = parseJsonSafe(raw);
    if (parsed != null) blocks.push(parsed);
  }
  return blocks;
}

function extractNextDataBlocks(html, parsed) {
  const blocks = [];
  if (parsed?.__NEXT_DATA__ && typeof parsed.__NEXT_DATA__ === 'object') {
    blocks.push(parsed.__NEXT_DATA__);
  }
  if (typeof parsed?.next_data_raw === 'string') {
    const p = parseJsonSafe(parsed.next_data_raw);
    if (p) blocks.push(p);
  }
  for (const b of extractJsonScriptBlocks(html, '__NEXT_DATA__\\/json')) {
    blocks.push(b);
  }
  return blocks;
}

function extractLdJsonBlocks(html, parsed) {
  const blocks = [];
  if (Array.isArray(parsed?.ld_json)) {
    for (const b of parsed.ld_json) {
      if (b && typeof b === 'object') blocks.push(b);
      else {
        const p = parseJsonSafe(b);
        if (p) blocks.push(p);
      }
    }
  } else if (parsed?.ld_json) {
    if (typeof parsed.ld_json === 'object') blocks.push(parsed.ld_json);
    else {
      const p = parseJsonSafe(parsed.ld_json);
      if (p) blocks.push(p);
    }
  }
  for (const b of extractJsonScriptBlocks(html, 'application\\/ld\\+json')) {
    blocks.push(b);
  }
  return blocks;
}

function extractFromStructuredJsonBlocks(blocks, strategy, seen, max = 300) {
  const offers = [];
  for (const block of blocks) {
    for (const obj of walkObjects(block)) {
      const candidate = extractFromObjectCandidate(obj, strategy);
      if (!candidate) continue;
      const key = `${candidate.product_name}__${candidate.current_price}__${candidate.image_url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push(candidate);
      if (offers.length >= max) return offers;
    }
  }
  return offers;
}

export function inferCityFromContext(context) {
  const parsed = context?.parsed || {};
  const meta = context?.metadata || {};
  const candidates = [
    parsed?.store_city,
    parsed?.city,
    parsed?.cidade,
    meta?.city,
    meta?.cidade,
    parsed?.store_name,
  ];
  for (const c of candidates) {
    const value = String(c || '').trim();
    if (!value) continue;
    const part = value.split(/[-,/|]/).map((p) => p.trim()).find(Boolean);
    if (!part) continue;
    const n = normalizeGeoText(part);
    if (n && n !== 'sp' && n !== 'sao paulo - sp') return part;
  }
  return null;
}

export function inferScopeByCity(city, grandeSpCitiesSet) {
  if (!city) return 'Estadual';
  return grandeSpCitiesSet.has(normalizeGeoText(city)) ? 'Grande SP' : 'Cidade';
}

export function buildUniversalOffersFromContext(context) {
  const parsed = context?.parsed || {};
  const rawHtml = String(parsed?.raw_html || context?.metadata?.raw_html || '');
  const offers = [];
  const seen = new Set();

  // Fase 2: prioridade total para JSON estruturado de frameworks/SEO.
  const nextDataBlocks = extractNextDataBlocks(rawHtml, parsed);
  const ldJsonBlocks = extractLdJsonBlocks(rawHtml, parsed);
  for (const c of extractFromStructuredJsonBlocks(nextDataBlocks, 'next_data', seen, 300)) {
    offers.push(c);
  }
  for (const c of extractFromStructuredJsonBlocks(ldJsonBlocks, 'ld_json', seen, 300)) {
    offers.push(c);
  }

  // Fallback 1: objetos já serializados em parsed (API interna / scraping parcial).
  if (offers.length === 0) {
    for (const obj of walkObjects(parsed)) {
      const candidate = extractFromObjectCandidate(obj, 'parsed_object');
      if (!candidate) continue;
      const key = `${candidate.product_name}__${candidate.current_price}__${candidate.image_url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push(candidate);
      if (offers.length >= 300) break;
    }
  }

  // Fallback 2: regex HTML genérico.
  if (offers.length === 0 && rawHtml) {
    for (const c of extractFromHtmlText(rawHtml)) {
      const key = `${c.product_name}__${c.current_price}__${c.image_url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push(c);
      if (offers.length >= 300) break;
    }
  }

  return {
    offers,
    isStatewide: detectStatewideOffer(parsed),
  };
}


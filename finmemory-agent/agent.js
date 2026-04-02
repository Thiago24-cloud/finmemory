/**
 * FinMemory — Supermarket Promotions Agent (Playwright + Supabase)
 *
 * Scheduler (Cloud Run Job / cron) → este agent → Supabase
 *
 *   npm install
 *   npm run setup
 *
 * Uso:
 *   node agent.js
 *   node agent.js --only=dia
 *   node agent.js --only=dia,assai
 *   node agent.js --dry-run
 *   node agent.js --headless=false
 *
 * Redes: dia | atacadao | assai | carrefour | paodeacucar | hirota | lopes | sonda | saojorge | mambo | agape | armazemdocampo
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_KEY (service_role) ou SUPABASE_SERVICE_ROLE_KEY
 *      TTL_HOURS (default 72), CONCURRENCY (default 1), LOG_LEVEL
 *      DIA_STORE_URL + DIA_STORE_URLS (várias lojas DIA); DIA_MAX_STORE_PAGES (default 250 capital; com DIA_REGION_INCLUDE_ALL_NODES=1 default 700 até 800); stores.promo_page_url
 *      Job só DIA capital: npm run promo:dia (na raiz do repo). São ~121 fetchs sequenciais de page-data por loja (+ pausas); num Cloud Run Job use task timeout ≥ 3600s (ex.: 5400s se a rede estiver lenta).
 *      DIA_REGION_PAGE_PATHS — lista de rotas Gatsby (ex.: lojas-sp-capital) cujo page-data.json expõe lojas; cada slug vira URL /lojas/{slug}/ para tabloide no mapa.
 *      Em lojas-sp-capital o JSON mistura cidades do estado; por defeito só entram slugs sp-sao-paulo-* (município São Paulo). DIA_REGION_INCLUDE_ALL_NODES=1 inclui todos os nós.
 *      DIA_SKIP_REGION_LIST=1 — não expandir listagens (só env + Supabase + default).
 *      PROMO_FANOUT_MAX_STORES — ofertas nacionais replicadas por loja em public.stores
 *
 * Estratégia de conteúdo: tudo o que a rede coloca no site (ofertas, vitrines, encartes, destaques)
 * conta como “divulgação pública” — não é catálogo completo; o mapa trata como camada promocional.
 *
 * Tabela: supabase_schema.sql (nome_produto, preco, run_id text, UNIQUE supermercado+nome_produto+run_id)
 */

'use strict';

const path = require('path');
// Raiz do monorepo (fallback); ficheiros do agente sobrepõem com override para credenciais específicas.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: true });

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const pLimit = require('p-limit');

const DIA_INCLUDE_ALL_REGION_NODES = /^1|true|yes$/i.test(
  String(process.env.DIA_REGION_INCLUDE_ALL_NODES || '').trim()
);
const DIA_MAX_DEFAULT = DIA_INCLUDE_ALL_REGION_NODES ? 700 : 250;
const DIA_MAX_PARSED = Number(process.env.DIA_MAX_STORE_PAGES);
const DIA_MAX_RESOLVED = Math.max(
  1,
  Math.min(
    800,
    Number.isFinite(DIA_MAX_PARSED) && DIA_MAX_PARSED > 0 ? DIA_MAX_PARSED : DIA_MAX_DEFAULT
  )
);

const ENV = {
  SUPABASE_URL:
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_SERVICE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '',
  TTL_HOURS: Number(process.env.TTL_HOURS ?? 72),
  CONCURRENCY: Math.max(1, Number(process.env.CONCURRENCY ?? 1)),
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  PROMO_FANOUT_MAX_STORES: Math.max(
    1,
    Math.min(500, Number(process.env.PROMO_FANOUT_MAX_STORES ?? 80))
  ),
  DIA_MAX_STORE_PAGES: DIA_MAX_RESOLVED,
};

/** Ofertas do site nacional → uma cópia por loja no mapa (exceto lopes/dia, que têm outra lógica). */
const FANOUT_CHAINS = new Set([
  'atacadao',
  'assai',
  'carrefour',
  'paodeacucar',
  'hirota',
  'sonda',
  'saojorge',
  'mambo',
  'agape',
  'armazemdocampo',
]);

const CHAIN_STORE_ALIASES = {
  dia: ['dia'],
  atacadao: ['atacadao', 'atacadão'],
  assai: ['assai'],
  carrefour: ['carrefour'],
  paodeacucar: ['pao de acucar', 'acucar', 'minuto pao de acucar'],
  hirota: ['hirota'],
  lopes: ['lopes'],
  sonda: ['sonda'],
  saojorge: [
    'sao jorge',
    'sacolao sao jorge',
    'sacolão são jorge',
    'sacolao são jorge',
    'grupo sao jorge',
  ],
  mambo: ['mambo'],
  agape: ['agape', 'supermercado agape', 'super agape', 'agape supermercado'],
  armazemdocampo: [
    'armazem do campo',
    'armazém do campo',
    'armazemdocampo',
    'armazém do campo sp',
    'armazem do campo sp',
  ],
};

const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const IS_DRY_RUN = ARGS['dry-run'] === true;
const IS_HEADLESS = ARGS.headless !== 'false';
const ONLY = typeof ARGS.only === 'string' ? ARGS.only : null;

const log = {
  debug: (...a) => ENV.LOG_LEVEL === 'debug' && console.debug('[DEBUG]', ...a),
  info: (...a) => console.log('[INFO ]', ...a),
  warn: (...a) => console.warn('[WARN ]', ...a),
  error: (...a) => console.error('[ERROR]', ...a),
};

const supabase =
  ENV.SUPABASE_URL && ENV.SUPABASE_SERVICE_KEY
    ? createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_KEY)
    : null;

const sleep = (min, max) =>
  new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min)
  );

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 400;
      const t = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(t);
          resolve();
        }
      }, 150);
    });
  });
  await sleep(600, 1200);
}

function parsePrice(raw) {
  if (!raw) return null;
  const s = String(raw);
  // "A partir de R$ 9,98" ou dois preços — último BRL costuma ser o vigente.
  const matches = [...s.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,5},\d{2})/gi)];
  if (matches.length) {
    const last = matches[matches.length - 1][1];
    const n = parseFloat(last.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = parseFloat(
    s.replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.').trim()
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDate(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (!m) return null;
  const d = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  const yr = m[3]
    ? m[3].length === 2
      ? `20${m[3]}`
      : m[3]
    : String(new Date().getFullYear());
  return `${yr}-${mo}-${d}`;
}

function sanitizeProductName(raw) {
  const txt = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!txt) return null;
  const noPriceTail = txt.replace(/\s+R\$\s*\d[\d\.,]*/gi, '').trim();
  const base = noPriceTail || txt;
  if (base.length < 3) return null;
  // Evita estourar índice UNIQUE (supermercado + nome_produto + run_id).
  if (base.length > 180) return base.slice(0, 180).trim();
  return base;
}

/** URLs de imagem que não são mercadoria (ícones, pagamento, redes sociais, tracking). */
function isChaffImageUrl(src, alt) {
  const t = `${String(src || '')} ${String(alt || '')}`.toLowerCase();
  if (!t.trim()) return true;
  const bad = [
    'logo',
    'favicon',
    '/icon',
    '/icons/',
    'sprite',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'whatsapp',
    'mastercard',
    'visa',
    'elo_',
    'google-',
    'apple-pay',
    '1x1',
    'pixel.gif',
    'blank.gif',
    'spacer',
    'avatar',
    'gravatar',
    'payment-method',
    'bandeira',
    'selo-',
    '-selo',
    'trustvox',
    '/static/img/social',
    'googletagmanager',
    'doubleclick',
    'hotjar',
  ];
  return bad.some((b) => t.includes(b));
}

/**
 * Junta itens “só imagem” (encarte / vitrine) sem duplicar URL de imagem.
 */
function mergePublicityImages(existing, extra, maxAdd = 45) {
  const out = Array.isArray(existing) ? [...existing] : [];
  const seenImg = new Set();
  for (const it of out) {
    const u = String(it?.imagem || '').trim();
    if (u) seenImg.add(u);
  }
  let added = 0;
  for (const it of extra || []) {
    if (added >= maxAdd) break;
    const u = String(it?.imagem || '').trim();
    if (!u || seenImg.has(u)) continue;
    seenImg.add(u);
    out.push(it);
    added++;
  }
  return out;
}

function isLikelyJunkOffer(name, price) {
  const n = normalizeText(name);
  if (!n || n.length < 4) return true;
  const generic = [
    'ofertas',
    'oferta',
    'faixa de preco',
    'faixa de preço',
    'preco',
    'preço',
    'promocoes',
    'promocoes',
    'promocao',
    'promocao',
    'categoria',
    'banner',
    'encarte',
    'tabloide',
  ];
  if (generic.some((g) => n === normalizeText(g))) return true;
  if (price != null && Number.isFinite(Number(price)) && Number(price) < 1) return true;
  return false;
}

function normalizeText(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function storeMatchesChain(storeName, chainKey) {
  const words = CHAIN_STORE_ALIASES[chainKey];
  if (!words) return false;
  const n = normalizeText(storeName);
  if (chainKey === 'dia') {
    if (/\b(supermercado|mercado)\s+dia\b|\bdia\s+(supermercado|market|express)\b/.test(n))
      return true;
    return /\bdia\b/.test(n);
  }
  return words.some((w) => n.includes(normalizeText(w)));
}

let _storesLatLngCache = null;

async function getAllStoresWithCoords() {
  if (_storesLatLngCache) return _storesLatLngCache;
  if (!supabase) {
    _storesLatLngCache = [];
    return _storesLatLngCache;
  }
  const { data, error } = await supabase
    .from('stores')
    .select('id,name,lat,lng')
    .eq('active', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(5000);
  _storesLatLngCache = error || !data ? [] : data;
  return _storesLatLngCache;
}

async function getAllStoresForChain(chainKey) {
  const words = CHAIN_STORE_ALIASES[chainKey];
  if (!words) return [];
  const data = await getAllStoresWithCoords();
  return data.filter((s) => storeMatchesChain(s.name, chainKey));
}

async function getChainCoordsFallback() {
  const coords = {};
  const centerSp = { lat: -23.5505, lng: -46.6333 };
  const dist2 = (a, b) =>
    Math.pow(Number(a.lat) - Number(b.lat), 2) + Math.pow(Number(a.lng) - Number(b.lng), 2);
  for (const chainKey of Object.keys(CHAIN_STORE_ALIASES)) {
    const matched = await getAllStoresForChain(chainKey);
    if (!matched.length) continue;
    const closest = matched
      .map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) }))
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .sort((a, b) => dist2(a, centerSp) - dist2(b, centerSp))[0];
    if (closest) coords[chainKey] = { lat: closest.lat, lng: closest.lng };
  }
  return coords;
}

async function withRetry(fn, { retries = 3, label = 'task' } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = attempt * 5000;
      log.warn(
        `${label} failed (attempt ${attempt}/${retries}). Retrying in ${wait / 1000}s…`
      );
      await sleep(wait, wait + 2000);
    }
  }
}

/**
 * Dia (Gatsby): ofertas vêm como tabloides (imagens) em page-data.json — não há R$ no DOM.
 * Exige URL de LOJA: /lojas/{slug}/ — defina DIA_STORE_URL ou use o default (Pinheiros SP).
 */
function diaSlugFromStoreUrl(storeUrl) {
  try {
    const u = new URL(storeUrl);
    const m = u.pathname.match(/\/lojas\/([^/]+)\/?$/);
    return m ? m[1] : null;
  } catch (_) {
    return null;
  }
}

async function scrapeDiaPageData(storeUrlOverride) {
  const defaultStore =
    'https://www.dia.com.br/lojas/sp-sao-paulo-pinheiros-rua-teodoro-sampaio-1249-1251';
  const explicitUrl = (storeUrlOverride || '').trim();
  let storeUrl = explicitUrl || (process.env.DIA_STORE_URL || '').trim() || defaultStore;
  let slug = diaSlugFromStoreUrl(storeUrl);
  if (!slug || slug === '...' || slug.includes('..')) {
    if (explicitUrl) {
      throw new Error(`URL de loja DIA inválida: ${explicitUrl}`);
    }
    log.warn(
      'DIA_STORE_URL ausente ou placeholder; usando loja padrão (Pinheiros SP).'
    );
    storeUrl = defaultStore;
    slug = diaSlugFromStoreUrl(storeUrl);
  }
  if (!slug) {
    throw new Error(
      'DIA_STORE_URL deve ser uma página de loja, ex.: https://www.dia.com.br/lojas/sp-sao-paulo-pinheiros-...'
    );
  }

  const jsonUrl = `https://www.dia.com.br/page-data/lojas/${slug}/page-data.json`;
  const res = await fetch(jsonUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 FinMemory-PromoBot/1.0',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`page-data.json HTTP ${res.status}`);
  }
  const j = await res.json();
  const loja = j?.result?.data?.loja;
  const tab = j?.result?.data?.tabloide;
  const offers = Array.isArray(tab?.offer) ? tab.offer : [];
  const origin = 'https://www.dia.com.br';

  const lojaLabel = loja?.name ? `Dia ${loja.name}` : 'Supermercado Dia';
  const lojaLat =
    loja?.lat != null && loja.lat !== '' ? parseFloat(String(loja.lat)) : null;
  const lojaLng =
    loja?.lng != null && loja.lng !== '' ? parseFloat(String(loja.lng)) : null;

  const items = [];
  offers.forEach((o, i) => {
    const cat = o?.category?.name || 'Geral';
    const src = o?.image?.childImageSharp?.gatsbyImageData?.images?.fallback?.src;
    if (!src) return;
    const imagem = src.startsWith('http') ? src : `${origin}${src}`;
    const nome = `${lojaLabel} — Tabloide ${cat} #${i + 1}`;
    let validade = null;
    if (o.finishDate) {
      try {
        validade = new Date(o.finishDate).toISOString().slice(0, 10);
      } catch (_) {}
    }
    items.push({
      nome,
      preco: null,
      imagem,
      validade,
      tipo: 'tabloide',
      lat: Number.isFinite(lojaLat) ? lojaLat : null,
      lng: Number.isFinite(lojaLng) ? lojaLng : null,
    });
  });

  return items;
}

function normalizeDiaStoreUrl(u) {
  const t = String(u || '')
    .trim()
    .split('?')[0]
    .replace(/\/$/, '');
  if (!t || !/\/lojas\//i.test(t)) return null;
  try {
    const x = new URL(t.startsWith('http') ? t : `https://${t}`);
    const h = x.hostname.toLowerCase();
    if (h !== 'dia.com.br' && h !== 'www.dia.com.br') return null;
    return x.toString().replace(/\/$/, '');
  } catch (_) {
    return null;
  }
}

/**
 * O site DIA (Gatsby) publica listagens regionais; cada uma tem page-data com `lojas.nodes[]`
 * (slug, lat, lng, status). Assim descobrimos **todas** as URLs `/lojas/{slug}/` sem copiar HTML da página —
 * só o JSON público que o próprio site carrega (mesmo contrato que scrapeDiaPageData por loja).
 */
async function collectDiaUrlsFromRegionPageDataPaths(pathsStr) {
  const out = [];
  const parts = String(pathsStr || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  const origin = 'https://www.dia.com.br';
  for (const pathSeg of parts) {
    const jsonUrl = `${origin}/page-data/${pathSeg}/page-data.json`;
    try {
      const res = await fetch(jsonUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 FinMemory-PromoBot/1.0',
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        log.warn(`DIA listagem ${pathSeg}: HTTP ${res.status} (${jsonUrl})`);
        continue;
      }
      const j = await res.json();
      const nodes = j?.result?.data?.lojas?.nodes;
      if (!Array.isArray(nodes)) {
        log.warn(`DIA listagem ${pathSeg}: sem lojas.nodes`);
        continue;
      }
      const includeAllNodes = /^1|true|yes$/i.test(
        String(process.env.DIA_REGION_INCLUDE_ALL_NODES || '').trim()
      );
      const spCapitalSlugOnly =
        String(pathSeg).toLowerCase() === 'lojas-sp-capital' && !includeAllNodes;
      let n = 0;
      let skippedNonCapital = 0;
      for (const node of nodes) {
        if (node && node.status === false) continue;
        const slug = String(node?.slug || '').trim();
        if (!slug) continue;
        if (spCapitalSlugOnly && !/^sp-sao-paulo-/i.test(slug)) {
          skippedNonCapital += 1;
          continue;
        }
        out.push(`${origin}/lojas/${slug}`);
        n += 1;
      }
      const extra =
        spCapitalSlugOnly && skippedNonCapital
          ? ` (${skippedNonCapital} fora de SP capital ignoradas no JSON)`
          : '';
      log.info(`    📋 DIA região "${pathSeg}": ${n} loja(s) em page-data${extra}`);
    } catch (e) {
      log.warn(`DIA listagem ${pathSeg}: ${e.message}`);
    }
  }
  return out;
}

async function collectDiaStoreUrls() {
  const set = new Set();
  const add = (u) => {
    const n = normalizeDiaStoreUrl(u);
    if (n) set.add(n);
  };
  for (const part of (process.env.DIA_STORE_URLS || '').split(/[\n,]+/)) add(part);
  add(process.env.DIA_STORE_URL);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('promo_page_url')
        .eq('active', true)
        .not('promo_page_url', 'is', null)
        .limit(800);
      if (!error && data) {
        for (const row of data) add(row.promo_page_url);
      }
    } catch (_) {}
  }

  const skipRegion = /^1|true|yes$/i.test(String(process.env.DIA_SKIP_REGION_LIST || '').trim());
  const regionPaths =
    process.env.DIA_REGION_PAGE_PATHS != null && String(process.env.DIA_REGION_PAGE_PATHS).trim() !== ''
      ? String(process.env.DIA_REGION_PAGE_PATHS).trim()
      : 'lojas-sp-capital';

  if (!skipRegion && regionPaths) {
    const fromList = await collectDiaUrlsFromRegionPageDataPaths(regionPaths);
    for (const u of fromList) add(u);
  }

  const list = [...set];
  const defaultStore =
    'https://www.dia.com.br/lojas/sp-sao-paulo-pinheiros-rua-teodoro-sampaio-1249-1251';
  if (!list.length) list.push(defaultStore);
  return list.slice(0, ENV.DIA_MAX_STORE_PAGES);
}

/** URL normalizada da loja → lat/lng/nome em public.stores (pins do mapa batem com o tabloide). */
async function loadDiaPromoUrlToStoreMeta() {
  const map = new Map();
  if (!supabase) return map;
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('lat, lng, name, promo_page_url')
      .eq('active', true)
      .not('promo_page_url', 'is', null)
      .limit(800);
    if (error || !data) return map;
    for (const row of data) {
      const k = normalizeDiaStoreUrl(row.promo_page_url);
      if (!k) continue;
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      map.set(k, { lat, lng, name: String(row.name || '').trim() || null });
    }
  } catch (_) {}
  return map;
}

function buildPromoRowsFromRaw(raw, scraper, runId, now, expireAt, chainCoords, ingestSource) {
  const deferCoords = FANOUT_CHAINS.has(scraper.key);
  const source =
    ingestSource != null && String(ingestSource).trim()
      ? String(ingestSource).trim()
      : `finmemory_agent:${scraper.key}`;
  const rows = [];
  const seenNome = new Set();
  for (const p of raw) {
    const price = parsePrice(p.preco);
    if (price == null && !p.imagem) continue;
    const nome_produto = sanitizeProductName(p.nome);
    if (isLikelyJunkOffer(nome_produto, price)) continue;
    if (!nome_produto || seenNome.has(nome_produto)) continue;
    seenNome.add(nome_produto);
    let vd = null;
    if (p.validade) {
      const vs = String(p.validade);
      vd = /^\d{4}-\d{2}-\d{2}$/.test(vs) ? vs : parseDate(vs);
    }
    const latP =
      p.lat != null && Number.isFinite(Number(p.lat)) ? Number(p.lat) : null;
    const lngP =
      p.lng != null && Number.isFinite(Number(p.lng)) ? Number(p.lng) : null;
    const gtinRaw =
      p.gtin != null && String(p.gtin).trim() ? String(p.gtin).trim() : null;
    rows.push({
      supermercado: scraper.key,
      nome_produto,
      preco: price,
      preco_original: p.preco != null ? String(p.preco) : null,
      imagem_url: p.imagem ?? null,
      validade: vd,
      lat: latP ?? (deferCoords ? null : chainCoords[scraper.key]?.lat ?? null),
      lng: lngP ?? (deferCoords ? null : chainCoords[scraper.key]?.lng ?? null),
      run_id: String(runId),
      atualizado_em: now,
      expira_em: expireAt,
      ativo: true,
      gtin: gtinRaw,
      ingest_source: source,
    });
  }
  return rows;
}

/** Preenche product_id quando existe produto com o mesmo GTIN em public.products (mapa usa imagem do bucket). */
async function resolveProductIdsForPromoRows(rows) {
  if (!supabase || !rows?.length) {
    return rows.map(({ gtin, ...r }) => r);
  }
  const gtins = [...new Set(rows.map((r) => r.gtin).filter(Boolean))];
  if (!gtins.length) {
    return rows.map(({ gtin, ...r }) => r);
  }
  const { data, error } = await supabase
    .from('products')
    .select('id, gtin')
    .in('gtin', gtins);
  if (error || !data?.length) {
    return rows.map(({ gtin, ...r }) => r);
  }
  const byGtin = new Map(data.map((p) => [p.gtin, p.id]));
  return rows.map((r) => {
    const { gtin, ...rest } = r;
    const pid = gtin && byGtin.has(gtin) ? byGtin.get(gtin) : null;
    if (pid) rest.product_id = pid;
    return rest;
  });
}

async function applyFanOutOrFallbackCoords(key, rows, chainCoords) {
  if (!FANOUT_CHAINS.has(key)) {
    return rows.map((r) => ({
      ...r,
      lat: r.lat ?? chainCoords[key]?.lat ?? null,
      lng: r.lng ?? chainCoords[key]?.lng ?? null,
    }));
  }
  const storesList = await getAllStoresForChain(key);
  const cap = storesList.slice(0, ENV.PROMO_FANOUT_MAX_STORES);
  if (!cap.length) {
    return rows.map((r) => ({
      ...r,
      lat: r.lat ?? chainCoords[key]?.lat ?? null,
      lng: r.lng ?? chainCoords[key]?.lng ?? null,
    }));
  }
  const expanded = [];
  for (const r of rows) {
    if (r.lat != null && r.lng != null) {
      expanded.push(r);
      continue;
    }
    for (const st of cap) {
      const sid = st.id != null ? String(st.id).replace(/-/g, '').slice(-8) : `${st.lat},${st.lng}`;
      const label = `${String(st.name || 'Loja').trim()} #${sid}`;
      expanded.push({
        ...r,
        nome_produto: `${r.nome_produto} · ${label}`.slice(0, 280),
        lat: Number(st.lat),
        lng: Number(st.lng),
      });
    }
  }
  return expanded;
}

async function runDiaMulti(runId, now, expireAt, chainCoords) {
  log.info(`\n🛒  ${SCRAPERS.dia.label} (várias lojas)`);
  const urls = await collectDiaStoreUrls();
  const urlToStore = await loadDiaPromoUrlToStoreMeta();
  log.info(`    📍 ${urls.length} página(s) de loja (${urlToStore.size} com promo_page_url em stores)`);
  const raw = [];
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    try {
      const chunk = await withRetry(() => scrapeDiaPageData(u), {
        retries: 2,
        label: `DIA ${i + 1}/${urls.length}`,
      });
      const key = normalizeDiaStoreUrl(u);
      const meta = key ? urlToStore.get(key) : null;
      if (meta) {
        for (const item of chunk) {
          item.lat = meta.lat;
          item.lng = meta.lng;
        }
      }
      log.info(`    📦 ${chunk.length} itens — ${u.slice(0, 88)}${meta ? ' (coords → stores)' : ''}`);
      raw.push(...chunk);
    } catch (e) {
      log.warn(`    Ignorada (${u.slice(0, 60)}…): ${e.message}`);
    }
    if (i < urls.length - 1) await sleep(400, 1100);
  }
  const scraper = SCRAPERS.dia;
  const rows = buildPromoRowsFromRaw(raw, scraper, runId, now, expireAt, chainCoords);
  if (!rows.length) {
    log.warn('    Nenhuma linha válida — dia');
    await writeToSupabase([], 'dia', runId, now, expireAt);
    return;
  }
  await writeToSupabase(rows, 'dia', runId, now, expireAt);
}

function normalizePriceString(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^R\$/i.test(s)) return s;
  const num = Number(String(s).replace(',', '.'));
  if (Number.isFinite(num) && num > 0) {
    return `R$ ${num.toFixed(2).replace('.', ',')}`;
  }
  return null;
}

function collectItemsFromAnyJson(node, out) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((x) => collectItemsFromAnyJson(x, out));
    return;
  }
  if (typeof node !== 'object') return;

  const name = node.name || node.productName || node.title || node.description;
  const directPrice =
    node.price ??
    node.promoPrice ??
    node.marketingPrice ??
    node.listPrice ??
    node.spotPrice ??
    node.teaserPrice ??
    node.bestPrice ??
    node.sellingPrice ??
    node.finalPrice ??
    node.lowPrice ??
    node.highPrice ??
    node?.offers?.price ??
    node?.offers?.lowPrice;
  const price = normalizePriceString(directPrice);
  if (name && price) {
    const gtin =
      node.gtin ||
      node.ean ||
      node.gtin13 ||
      node.barcode ||
      null;
    out.push({
      nome: String(name),
      preco: price,
      imagem: node.image || node.imageUrl || null,
      gtin: gtin != null ? String(gtin).replace(/\D/g, '') || null : null,
    });
  }

  Object.values(node).forEach((v) => collectItemsFromAnyJson(v, out));
}

async function scrapeGenericOffersFromPage(page, url) {
  if (!url) return [];
  const netItems = [];

  const onResponse = async (resp) => {
    try {
      const ct = (resp.headers()['content-type'] || '').toLowerCase();
      if (!ct.includes('json')) return;
      const u = (resp.url() || '').toLowerCase();
      if (
        !/(oferta|offer|product|produto|search|shelf|catalog|graphql|vtex|collection|categoria|category|destaque|vitrine|sku|listing|items|carousel|deals|merchandising|\/api\/|ecommerce|loja|\/p\/|\/pr\/|plp|shelf)/.test(
          u
        )
      ) {
        return;
      }
      const txt = await resp.text();
      if (!txt || txt.length < 2) return;
      const parsed = JSON.parse(txt);
      collectItemsFromAnyJson(parsed, netItems);
    } catch (_) {}
  };

  page.on('response', onResponse);
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await sleep(1800, 3200);
    await autoScroll(page);
    await sleep(800, 1400);
  } finally {
    page.off('response', onResponse);
  }

  const domItems = await page.evaluate(() => {
    const out = [];
    const seen = new Set();

    const add = (nome, preco, imagem) => {
      const n = String(nome || '').replace(/\s+/g, ' ').trim();
      const p = String(preco || '').replace(/\s+/g, ' ').trim();
      if (!n || !p) return;
      if (n.length > 180) return;
      const k = `${n.toLowerCase()}|${p}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ nome: n, preco: p, imagem: imagem || null });
    };

    const getPriceText = (txt) => {
      if (!txt) return null;
      const m = String(txt).match(/R\$\s*\d{1,4}(?:\.\d{3})*,\d{2}/i);
      return m ? m[0] : null;
    };

    const walkJson = (node) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(walkJson);
        return;
      }
      if (typeof node !== 'object') return;
      const name = node.name || node.productName || node.title;
      const directPrice =
        node.price ??
        node.lowPrice ??
        node.highPrice ??
        node?.offers?.price ??
        node?.offers?.lowPrice;
      if (name && directPrice != null) {
        add(name, `R$ ${String(directPrice).replace('.', ',')}`, node.image || null);
      }
      Object.values(node).forEach(walkJson);
    };

    document
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach((s) => {
        try {
          const j = JSON.parse(s.textContent || 'null');
          walkJson(j);
        } catch (_) {}
      });

    document.querySelectorAll('script:not([src])').forEach((s) => {
      const t = s.textContent || '';
      if (!t || t.length < 200) return;
      const re =
        /"name"\s*:\s*"([^"]{3,160})"[\s\S]{0,260}?"price"\s*:\s*"?(\d{1,4}(?:[.,]\d{2})?)"?/gi;
      let m;
      while ((m = re.exec(t))) {
        add(m[1], `R$ ${m[2].replace('.', ',')}`, null);
      }
    });

    const cards = document.querySelectorAll(
      'article,li,div,[class*="product"],[class*="item"],[class*="offer"],[data-testid*="product"]'
    );
    cards.forEach((card) => {
      const text = card.textContent || '';
      if (!/R\$\s*\d/.test(text)) return;
      const price = getPriceText(text);
      if (!price) return;
      const nameEl = card.querySelector(
        'h1,h2,h3,h4,strong,[class*="name"],[class*="title"],[class*="product"]'
      );
      const nome = (nameEl?.textContent || '').trim();
      const imagem = card.querySelector('img')?.src || null;
      if (nome && nome.length >= 3) add(nome, price, imagem);
    });

    return out;
  });

  const merged = [];
  const seen = new Set();
  for (const item of [...netItems, ...domItems]) {
    const nome = sanitizeProductName(item?.nome);
    const preco = normalizePriceString(item?.preco);
    if (!nome || !preco) continue;
    const key = `${nome.toLowerCase()}|${preco}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ nome, preco, imagem: item?.imagem || null });
  }
  return merged;
}

/**
 * Imagens relevantes na página atual: antes só URL/alt com palavras de “oferta”.
 * Agora também aceita imagens grandes (vitrine/destaque público), excluindo lixo comum.
 */
async function scrapeFlyerImagesFromPage(page, chainLabel, options = {}) {
  const publicSurface = options.publicSurface !== false;

  const imgs = await page.evaluate((pub) => {
    const out = [];
    const seen = new Set();
    const nodes = document.querySelectorAll('img[src]');
    const promoRe =
      /(oferta|promoc|encarte|folheto|campanha|banner|rpa|tabloide|destaque|vitrine|produto|sku|gondola|mercearia|shelf|card)/;
    nodes.forEach((img) => {
      const src = String(img.src || '').trim();
      if (!src || src.startsWith('data:') || seen.has(src)) return;
      const alt = String(img.alt || '').trim();
      const w = Number(img.naturalWidth || img.width || 0);
      const h = Number(img.naturalHeight || img.height || 0);
      const text = `${src} ${alt}`.toLowerCase();
      const promoLike = promoRe.test(text);
      const minSide = 180;
      const minPublic = 200;
      if (w > 0 && h > 0 && (w < minSide || h < minSide)) return;
      if (promoLike) {
        seen.add(src);
        out.push({ src, alt, w, h });
        return;
      }
      if (pub && w >= minPublic && h >= minPublic) {
        seen.add(src);
        out.push({ src, alt, w, h });
      }
    });
    return out;
  }, publicSurface);

  const filtered = (imgs || []).filter((it) => !isChaffImageUrl(it.src, it.alt));
  const max = options.maxImages ?? 55;
  return filtered.slice(0, max).map((it, i) => ({
    nome: `${chainLabel} — Divulgação ${it.alt ? it.alt.slice(0, 60) : `#${i + 1}`}`.trim(),
    preco: null,
    imagem: it.src,
    tipo: 'encarte',
  }));
}

async function scrapeAssaiStaticOffers() {
  const url = 'https://www.assai.com.br/sites/default/files/static/ofertas_assai.json';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 FinMemory-PromoBot/1.0', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`ofertas_assai.json HTTP ${res.status}`);
  const j = await res.json();
  const ofertas = Array.isArray(j?.ofertas) ? j.ofertas : [];
  const origin = 'https://www.assai.com.br';
  const items = [];
  for (const oferta of ofertas) {
    const start = oferta?.start_date || '';
    const end = oferta?.end_date || '';
    const validade = parseDate(end);
    const custom = String(oferta?.custom_text || '').trim();
    const title = String(oferta?.title || '').trim();
    const images = Array.isArray(oferta?.images) ? oferta.images : [];
    images.forEach((img, idx) => {
      const srcRaw = img?.url || img?.src || img?.image || '';
      if (!srcRaw) return;
      const imagem = String(srcRaw).startsWith('http') ? String(srcRaw) : `${origin}${srcRaw}`;
      const imgId = img?.id || img?.image_id || idx + 1;
      const nome = `Assaí — Encarte ${title || custom || `${start} até ${end}`} #${imgId}`.slice(0, 180);
      items.push({ nome, preco: null, imagem, validade, tipo: 'encarte' });
    });
  }
  return items;
}

async function scrapeLopesTabloides() {
  const url = 'https://www.supermercadolopes.com.br/api/tabloides';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 FinMemory-PromoBot/1.0', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`api/tabloides HTTP ${res.status}`);
  const data = await res.json();
  const stores = Array.isArray(data) ? data : [];
  const origin = 'https://www.supermercadolopes.com.br/';
  const items = [];
  for (const store of stores) {
    const storeName = String(store?.nome_loja || 'Lopes').trim();
    const tabloides = Array.isArray(store?.tabloide) ? store.tabloide : [];
    for (const tab of tabloides) {
      const categoria = String(tab?.nome_categoria || 'Encarte').trim();
      const arquivos = Array.isArray(tab?.arquivos) ? tab.arquivos : [];
      arquivos.forEach((f, idx) => {
        const s = String(f || '').trim();
        if (!s) return;
        const imagem = s.startsWith('http') ? s : `${origin}${s.replace(/^\/+/, '')}`;
        const nome = `Lopes ${storeName} — ${categoria} #${idx + 1}`.slice(0, 180);
        items.push({ nome, preco: null, imagem, validade: null, tipo: 'encarte' });
      });
    }
  }
  return items.slice(0, 400);
}

const SCRAPERS = {
  dia: {
    key: 'dia',
    label: 'Supermercado Dia',
    /** Várias lojas: `runDiaMulti` (não usa este fetch). */
    usePageData: true,
  },

  atacadao: {
    key: 'atacadao',
    label: 'Atacadão',
    url: 'https://www.atacadao.com.br/ofertas',
    run: async (page) => {
      await page.goto('https://www.atacadao.com.br/ofertas', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await sleep(1500, 3000);
      await autoScroll(page);
      return page.evaluate(() => {
        const items = [];
        const sel =
          '[class*="product-card"],[class*="ProductCard"],[class*="product-item"],[data-testid*="product"]';
        document.querySelectorAll(sel).forEach((card) => {
          const nome = card.querySelector(
            '[class*="name"],[class*="title"],h2,h3'
          )?.innerText?.trim();
          const preco = card
            .querySelector('[class*="price"],[class*="Price"]')
            ?.innerText?.trim();
          const imagem = card.querySelector('img')?.src;
          if (nome && preco) items.push({ nome, preco, imagem });
        });
        return items;
      });
    },
  },

  assai: {
    key: 'assai',
    label: 'Assaí Atacadista',
    usePageData: true,
    fetch: scrapeAssaiStaticOffers,
    url: 'https://www.assai.com.br/ofertas',
    run: async (page) => {
      await page.goto('https://www.assai.com.br/ofertas', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await sleep(1000, 2200);
      await autoScroll(page);
      return page.evaluate(() => {
        const items = [];
        const sel =
          '[class*="product-card"],[class*="ProductCard"],[class*="shelf-item"],[class*="product-item"]';
        document.querySelectorAll(sel).forEach((card) => {
          const nome = card.querySelector(
            '[class*="product-name"],[class*="ProductName"],h3,h2'
          )?.innerText?.trim();
          const preco = card
            .querySelector(
              '[class*="best-price"],[class*="Price"],[class*="price"]'
            )
            ?.innerText?.trim();
          const imagem = card.querySelector('img')?.src;
          if (nome && preco) items.push({ nome, preco, imagem });
        });
        return items;
      });
    },
  },

  carrefour: {
    key: 'carrefour',
    label: 'Carrefour',
    url: 'https://www.carrefour.com.br/ofertas',
    run: async (page) => {
      await page.goto('https://www.carrefour.com.br/ofertas', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await sleep(1500, 3000);
      await autoScroll(page);
      return page.evaluate(() => {
        const items = [];
        const sel =
          '[class*="product-card"],[class*="ProductCard"],[class*="offer-card"],[data-testid="product-card"]';
        document.querySelectorAll(sel).forEach((card) => {
          const nome = card.querySelector(
            '[class*="product-name"],[class*="ProductName"],h3,h2'
          )?.innerText?.trim();
          const preco = card
            .querySelector(
              '[class*="selling-price"],[class*="Price"],[class*="price"]'
            )
            ?.innerText?.trim();
          const imagem = card.querySelector('img')?.src;
          if (nome && preco) items.push({ nome, preco, imagem });
        });
        return items;
      });
    },
  },

  paodeacucar: {
    key: 'paodeacucar',
    label: 'Pão de Açúcar',
    url: 'https://www.paodeacucar.com/ofertas',
    run: async (page) => {
      await page.goto('https://www.paodeacucar.com/ofertas', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await sleep(1500, 2800);
      await autoScroll(page);
      await sleep(800, 1400);
      await autoScroll(page);
      await sleep(600, 1200);

      return page.evaluate(() => {
        const base = window.location.origin;

        function absolutize(href) {
          if (!href || typeof href !== 'string') return null;
          const s = href.trim();
          if (!s || s.startsWith('data:')) return null;
          try {
            if (s.startsWith('//')) return `https:${s}`;
            if (s.startsWith('http')) return s;
            return new URL(s, base).href;
          } catch (_) {
            return null;
          }
        }

        function srcFromSrcset(srcset) {
          if (!srcset || typeof srcset !== 'string') return null;
          const parts = srcset.split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean);
          for (const p of parts) {
            const a = absolutize(p);
            if (a && a.length > 8) return a;
          }
          return null;
        }

        /** Preferir imagem de produto (lazy-load / picture / várias imgs no card). */
        function bestImgFromCard(card) {
          function area(img) {
            if (!img || !img.naturalWidth) return 0;
            return img.naturalWidth * (img.naturalHeight || 1);
          }

          const candidates = [];

          const pic = card.querySelector('picture');
          if (pic) {
            for (const src of pic.querySelectorAll('source[srcset], source[data-srcset]')) {
              const ss =
                src.getAttribute('srcset') ||
                src.getAttribute('data-srcset') ||
                '';
              const u = srcFromSrcset(ss);
              if (u) candidates.push({ u, w: 10000 });
            }
          }

          const imgs = card.querySelectorAll('img');
          imgs.forEach((img) => {
            const attrs = [
              img.getAttribute('data-src'),
              img.getAttribute('data-lazy-src'),
              img.getAttribute('data-original'),
              img.getAttribute('data-image'),
              img.getAttribute('data-zoom-image'),
              img.currentSrc,
              img.getAttribute('src'),
            ];
            for (const raw of attrs) {
              if (!raw || String(raw).startsWith('data:')) continue;
              const u = absolutize(String(raw).trim());
              if (u) candidates.push({ u, w: area(img) });
            }
            const ss = img.getAttribute('srcset');
            const u = srcFromSrcset(ss);
            if (u) candidates.push({ u, w: area(img) });
          });

          const seen = new Set();
          const uniq = [];
          for (const c of candidates) {
            if (!c.u || seen.has(c.u)) continue;
            seen.add(c.u);
            uniq.push(c);
          }
          if (!uniq.length) return null;
          uniq.sort((a, b) => (b.w || 0) - (a.w || 0));
          return uniq[0].u;
        }

        const items = [];
        const sel =
          '[class*="product-card"],[class*="ProductCard"],[class*="product-item"],[class*="shelf-product"],article[data-product]';
        document.querySelectorAll(sel).forEach((card) => {
          const nome = card.querySelector(
            '[class*="product-name"],[class*="ProductName"],h3,h2'
          )?.innerText?.trim();
          const preco = card
            .querySelector(
              '[class*="selling-price"],[class*="price"],[class*="Price"]'
            )
            ?.innerText?.trim();
          const imagem = bestImgFromCard(card);
          if (nome && preco) items.push({ nome, preco, imagem });
        });
        return items;
      });
    },
  },

  hirota: {
    key: 'hirota',
    label: 'Hirota Food',
    url: 'https://www.lojahirota.com.br/ofertas',
    run: async (page) => {
      await page.goto('https://www.lojahirota.com.br/ofertas', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await sleep(1000, 2500);
      await autoScroll(page);
      return page.evaluate(() => {
        const items = [];
        document
          .querySelectorAll(
            '[class*="product"],[class*="prateleira"],[class*="Product"]'
          )
          .forEach((card) => {
            const nome = card.querySelector(
              '[class*="name"],[class*="nome"],h2,h3'
            )?.innerText?.trim();
            const preco = card
              .querySelector(
                '[class*="price"],[class*="preco"],[class*="Price"]'
              )
              ?.innerText?.trim();
            const imagem = card.querySelector('img')?.src;
            if (nome && preco) items.push({ nome, preco, imagem });
          });
        return items;
      });
    },
  },

  /**
   * E-commerce com preços em texto (ex.: "Por R$ 10,49"). Pode divergir da gôndola — tratar como sinal forte de oferta, não garantia 1:1 física.
   * Fan-out: lojas em `stores` cujo nome contém "Sonda".
   */
  sonda: {
    key: 'sonda',
    label: 'Sonda',
    url: 'https://www.sondadelivery.com.br/',
    run: async (page) => {
      await page.goto('https://www.sondadelivery.com.br/', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await sleep(2000, 4000);
      await autoScroll(page);
      return page.evaluate(() => {
        const items = [];
        document
          .querySelectorAll(
            'article, [class*="product"], [class*="Product"], [class*="card"], [class*="shelf"], [class*="vitrine"]'
          )
          .forEach((card) => {
            const nome = card
              .querySelector('h2, h3, h4, [class*="name"], [class*="title"], [class*="Name"]')
              ?.innerText?.trim();
            const blob = card.innerText || '';
            const preco =
              card.querySelector('[class*="price"], [class*="Price"], [class*="preco"]')?.innerText?.trim() ||
              (blob.match(/Por\s+R\$\s*[\d.,]+/i) || [])[0] ||
              (blob.match(/R\$\s*[\d.,]+/) || [])[0];
            const imagem = card.querySelector('img')?.src;
            if (nome && preco && /R\$\s*[\d.,]+/.test(preco)) items.push({ nome, preco, imagem });
          });
        return items;
      });
    },
  },

  lopes: {
    key: 'lopes',
    label: 'Lopes Supermercados',
    url: 'https://www.supermercadolopes.com.br/ofertas',
    run: async (page) => {
      await page.goto('https://www.supermercadolopes.com.br/super-ofertas', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await sleep(1500, 2600);
      return page.evaluate(async () => {
        const out = [];
        const seen = new Set();
        const add = (nome, imagem) => {
          const n = String(nome || '').replace(/\s+/g, ' ').trim().slice(0, 180);
          const img = String(imagem || '').trim();
          if (!n || !img) return;
          const key = `${n}|${img}`;
          if (seen.has(key)) return;
          seen.add(key);
          out.push({ nome: n, preco: null, imagem: img, tipo: 'encarte' });
        };

        try {
          const r = await fetch('/api/tabloides');
          if (r.ok) {
            const data = await r.json();
            const stores = Array.isArray(data) ? data : [];
            stores.forEach((store) => {
              const storeName = String(store?.nome_loja || 'Lopes').trim();
              const tabs = Array.isArray(store?.tabloide) ? store.tabloide : [];
              tabs.forEach((tab) => {
                const cat = String(tab?.nome_categoria || 'Encarte').trim();
                const arquivos = Array.isArray(tab?.arquivos) ? tab.arquivos : [];
                arquivos.forEach((a, idx) => {
                  const src = String(a || '').trim();
                  if (!src) return;
                  const abs = src.startsWith('http')
                    ? src
                    : `${location.origin}/${src.replace(/^\/+/, '')}`;
                  add(`Lopes ${storeName} — ${cat} #${idx + 1}`, abs);
                });
              });
            });
          }
        } catch (_) {}

        if (out.length) return out;

        const items = [];
        document
          .querySelectorAll('[class*="product"],[class*="offer"],[class*="item"]')
          .forEach((card) => {
            const nome = card.querySelector(
              '[class*="name"],[class*="title"],h2,h3'
            )?.innerText?.trim();
            const preco = card
              .querySelector('[class*="price"],[class*="preco"]')
              ?.innerText?.trim();
            const imagem = card.querySelector('img')?.src;
            if (nome && preco) items.push({ nome, preco, imagem });
          });
        return items;
      });
    },
  },

  mambo: {
    key: 'mambo',
    label: 'Mambo',
    url: 'https://www.mambo.com.br/lista-rapida',
    run: async (page) => {
      await page.goto('https://www.mambo.com.br/lista-rapida', {
        waitUntil: 'domcontentloaded',
        timeout: 120_000,
      });
      await sleep(4000, 7000);
      await autoScroll(page);
      return page.evaluate(() => {
        const items = [];
        document
          .querySelectorAll(
            '[class*="product"],[class*="Product"],[class*="shelf"],[class*="card"]'
          )
          .forEach((card) => {
            const nome = card
              .querySelector('h2,h3,h4,[class*="name"],[class*="title"],[class*="Name"]')
              ?.innerText?.trim();
            const preco = card
              .querySelector(
                '[class*="price"],[class*="Price"],[class*="preco"],[class*="Preco"]'
              )
              ?.innerText?.trim();
            const imagem = card.querySelector('img')?.src;
            if (nome && preco && /R\$\s*[\d.,]+/.test(preco)) items.push({ nome, preco, imagem });
          });
        return items;
      });
    },
  },

  agape: {
    key: 'agape',
    label: 'Ágape Supermercado',
    url: 'https://www.agapedelivery.com.br/agape/promocoes-99999',
    run: async (page) => {
      await page.goto('https://www.agapedelivery.com.br/agape/promocoes-99999', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await sleep(2000, 4000);
      await autoScroll(page);
      return page.evaluate(() => {
        const items = [];
        document
          .querySelectorAll(
            'a[href*="/agape/produto/"], [class*="product"],[class*="ProductCard"],[class*="shelf"]'
          )
          .forEach((card) => {
            const nome = card
              .querySelector(
                'h2,h3,h4,[class*="name"],[class*="Name"],[class*="title"]'
              )
              ?.innerText?.trim();
            const preco = card
              .querySelector(
                '[class*="price"],[class*="Price"],[class*="preco"]'
              )
              ?.innerText?.trim();
            const imagem = card.querySelector('img')?.src;
            if (nome && preco && /R\$\s*[\d.,]+/.test(preco)) items.push({ nome, preco, imagem });
          });
        return items;
      });
    },
  },

  armazemdocampo: {
    key: 'armazemdocampo',
    label: 'Armazém do Campo',
    url: 'https://armazemdocampo.shop/collections/all',
    run: async (page) => {
      const url = 'https://armazemdocampo.shop/collections/all';
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await page
        .waitForSelector('a[href*="/products/"]', { timeout: 25_000 })
        .catch(() => {});
      await sleep(2000, 4000);
      await autoScroll(page);
      await sleep(800, 1600);

      return page.evaluate(() => {
        const items = [];
        const seenHref = new Set();

        /** Preço BRL no texto (último = preço promocional quando há dois). */
        const brlRe =
          /(?:A\s+partir\s+de\s+)?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,5},\d{2})/gi;

        function bestImgUrl(root) {
          const img = root.querySelector('img');
          if (!img) return null;
          const pick = (u) => {
            const s = String(u || '').trim();
            if (!s || s.startsWith('data:')) return null;
            return s;
          };
          const fromSrcset = (ss) => {
            if (!ss) return null;
            const first = ss.split(',')[0]?.trim()?.split(/\s+/)?.[0];
            return pick(first);
          };
          return (
            pick(img.currentSrc) ||
            pick(img.src) ||
            pick(img.getAttribute('data-src')) ||
            pick(img.getAttribute('data-lazy-src')) ||
            fromSrcset(img.getAttribute('srcset')) ||
            fromSrcset(img.getAttribute('data-srcset'))
          );
        }

        const productAnchors = document.querySelectorAll('a[href*="/products/"]');
        productAnchors.forEach((a) => {
          const href = a.href || '';
          if (!href.includes('/products/') || seenHref.has(href)) return;

          const card =
            a.closest(
              'li.grid__item, .grid__item, .product-item, [data-product-id], .card-wrapper, article, .product-card, .product-grid-item'
            ) || a.closest('div[class*="product"]') || a.parentElement;
          const root = card || a;

          const blob = (root.innerText || '').replace(/\s+/g, ' ').trim();
          const priceMatches = [...blob.matchAll(brlRe)];
          const imagem = bestImgUrl(root);

          let nome = (blob.split(/R\$/i)[0] || '').trim();
          nome = nome
            .replace(/\s*Visualizar\s*$/i, '')
            .replace(/\s*Esgotado\s*$/i, '')
            .replace(/^A\s+partir\s+de\s+/i, '')
            .trim();

          if (!nome || nome.length < 3) {
            const imgEl = root.querySelector('img');
            const t = a.getAttribute('title') || imgEl?.getAttribute('alt');
            if (t) nome = String(t).replace(/\s+/g, ' ').trim().split(/R\$/i)[0].trim();
          }

          if (priceMatches.length) {
            const last = priceMatches[priceMatches.length - 1];
            const preco = `R$ ${last[1]}`;
            seenHref.add(href);
            items.push({ nome: nome.slice(0, 180), preco, imagem });
            return;
          }

          // Sem preço no texto (ex.: só "Esgotado") — ainda entra no mapa com imagem (divulgação).
          if (imagem && nome.length >= 3) {
            seenHref.add(href);
            items.push({
              nome: `${nome.slice(0, 160)} (indisponível)`.slice(0, 180),
              preco: null,
              imagem,
            });
          }
        });

        return items;
      });
    },
  },

  saojorge: {
    key: 'saojorge',
    label: 'Sacolão São Jorge',
    url: 'https://gruposaojorge.com.br/',
    run: async (page) => {
      await page.goto('https://gruposaojorge.com.br/', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await sleep(1200, 2600);
      await autoScroll(page);
      return page.evaluate(() => {
        const items = [];
        document
          .querySelectorAll(
            'article, [class*="product"], [class*="offer"], [class*="card"]'
          )
          .forEach((card) => {
            const nome = card
              .querySelector('h1,h2,h3,h4,strong,[class*="title"],[class*="name"]')
              ?.innerText?.trim();
            const preco = card
              .querySelector('[class*="price"],[class*="preco"],[class*="Price"]')
              ?.innerText?.trim();
            const imagem = card.querySelector('img')?.src;
            if (nome && preco && /R\$\s*\d/.test(preco)) items.push({ nome, preco, imagem });
          });
        return items;
      });
    },
  },
};

async function writeToSupabase(rows, supermarketSlug, runId, nowIso, expireIso) {
  if (IS_DRY_RUN) {
    log.info(`[DRY-RUN] gravaria ${rows.length} linhas — ${supermarketSlug}`);
    return;
  }
  if (!supabase) {
    log.error(
      'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY).'
    );
    return;
  }

  const { error: deactivateErr } = await supabase
    .from('promocoes_supermercados')
    .update({ ativo: false })
    .eq('supermercado', supermarketSlug)
    .eq('ativo', true);

  if (deactivateErr) {
    log.warn(`Desativar lote anterior (${supermarketSlug}): ${deactivateErr.message}`);
  }

  if (!rows.length) return;

  const chunkSize = 400;
  const rowsForDb = await resolveProductIdsForPromoRows(rows);
  for (let i = 0; i < rowsForDb.length; i += chunkSize) {
    const slice = rowsForDb.slice(i, i + chunkSize);
    const { error: insertErr } = await supabase
      .from('promocoes_supermercados')
      .insert(slice);
    if (insertErr) {
      throw new Error(`Supabase insert falhou (${supermarketSlug}): ${insertErr.message}`);
    }
  }

  log.info(`✅ ${rowsForDb.length} linhas — ${supermarketSlug} — TTL ${ENV.TTL_HOURS}h`);
}

async function runScraper(key, context, runId, now, expireAt, chainCoords = {}) {
  if (key === 'dia') {
    await runDiaMulti(runId, now, expireAt, chainCoords);
    return;
  }

  const scraper = SCRAPERS[key];
  log.info(`\n🛒  ${scraper.label}`);

  let raw;
  if (scraper.usePageData) {
    raw = await withRetry(() => scraper.fetch(), {
      retries: 3,
      label: scraper.label,
    });
    log.info(`    📦 ${raw.length} itens (page-data / API)`);
  } else {
    if (!context) throw new Error('Contexto do browser ausente');
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await page.route(/\.(woff2?|ttf)(\?|$)/i, (route) => route.abort());
    try {
      raw = await withRetry(() => scraper.run(page), {
        retries: 3,
        label: scraper.label,
      });
      if (!raw.length && scraper.url) {
        log.warn(`    ${scraper.key}: 0 produtos no seletor principal; tentando fallback genérico...`);
        raw = await withRetry(() => scrapeGenericOffersFromPage(page, scraper.url), {
          retries: 2,
          label: `${scraper.label} fallback`,
        });
        log.info(`    🔁 fallback: ${raw.length} produtos`);
      }
      if (
        !raw.length &&
        scraper.url &&
        [
          'assai',
          'lopes',
          'sonda',
          'saojorge',
          'mambo',
          'agape',
          'armazemdocampo',
          'atacadao',
          'carrefour',
          'paodeacucar',
          'hirota',
        ].includes(scraper.key)
      ) {
        log.warn(
          `    ${scraper.key}: sem preços parseáveis; tentando modo divulgação pública (imagem)...`
        );
        raw = await withRetry(() => scrapeFlyerImagesFromPage(page, scraper.label), {
          retries: 1,
          label: `${scraper.label} encarte`,
        });
        log.info(`    🖼️ imagens: ${raw.length}`);
      }

      // Complementar: na mesma página, tudo que a rede expõe em destaque (não só cards com preço).
      if (scraper.url) {
        try {
          const extra = await scrapeFlyerImagesFromPage(page, scraper.label, {
            publicSurface: true,
            maxImages: 50,
          });
          const n0 = raw.length;
          raw = mergePublicityImages(raw, extra, 48);
          if (raw.length > n0) {
            log.info(`    📢 divulgação pública: +${raw.length - n0} itens com imagem`);
          }
        } catch (e) {
          log.warn(`    merge divulgação pública: ${e.message}`);
        }
      }
    } finally {
      await page.close();
    }
    log.info(`    📦 ${raw.length} produtos`);
  }

  if (!raw.length) return;

  let rows = buildPromoRowsFromRaw(raw, scraper, runId, now, expireAt, chainCoords);
  rows = await applyFanOutOrFallbackCoords(key, rows, chainCoords);

  if (!rows.length) {
    log.warn(
      `    Nenhuma linha válida (precisa preço parseável ou imagem de divulgação) — ${scraper.key}`
    );
    // Mantém consistência: desativa lote antigo quando o scraping atual não trouxe itens válidos.
    await writeToSupabase([], scraper.key, runId, now, expireAt);
    return;
  }

  await writeToSupabase(rows, scraper.key, runId, now, expireAt);
}

async function main() {
  const runId = new Date().toISOString();
  const now = runId;
  const expireAt = new Date(
    Date.now() + ENV.TTL_HOURS * 3_600_000
  ).toISOString();

  const targets = ONLY
    ? ONLY.split(',').map((s) => s.trim().toLowerCase())
    : Object.keys(SCRAPERS);

  const invalid = targets.filter((k) => !SCRAPERS[k]);
  if (invalid.length) {
    log.error(`Redes desconhecidas: ${invalid.join(', ')}`);
    log.info(`Disponíveis: ${Object.keys(SCRAPERS).join(', ')}`);
    process.exit(1);
  }

  if (!IS_DRY_RUN && !supabase) {
    log.error('Sem Supabase. Configure credenciais ou use --dry-run.');
    process.exit(1);
  }

  log.info('═══════════════════════════════════════════════');
  log.info('  FinMemory — Supermarket Promotions Agent');
  log.info(`  Run ID    : ${runId}`);
  log.info(`  Targets   : ${targets.join(', ')}`);
  log.info(`  TTL       : ${ENV.TTL_HOURS}h`);
  log.info(`  Dry-run   : ${IS_DRY_RUN}`);
  log.info(`  Headless  : ${IS_HEADLESS}`);
  log.info('═══════════════════════════════════════════════\n');

  const needsBrowser = targets.some((k) => !SCRAPERS[k].usePageData);
  let browser = null;
  let context = null;
  if (needsBrowser) {
    browser = await chromium.launch({
      headless: IS_HEADLESS,
      slowMo: IS_HEADLESS ? 0 : 400,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });
  }

  const chainCoords = await getChainCoordsFallback();

  const limit = pLimit(ENV.CONCURRENCY);
  const results = { ok: [], failed: [] };

  await Promise.all(
    targets.map((key) =>
      limit(async () => {
        try {
          await runScraper(key, context, runId, now, expireAt, chainCoords);
          results.ok.push(key);
        } catch (err) {
          log.error(`FAILED ${key}: ${err.message}`);
          results.failed.push(key);
        }
        await sleep(3000, 7000);
      })
    )
  );

  if (browser) await browser.close();

  log.info('\n═══════════════════════════════════════════════');
  log.info(`  ✅  OK     : ${results.ok.join(', ') || 'nenhum'}`);
  if (results.failed.length) {
    log.info(`  ❌  Falhou : ${results.failed.join(', ')}`);
  }
  log.info('═══════════════════════════════════════════════\n');

  if (results.failed.length) process.exit(1);
}

main().catch((err) => {
  log.error('Erro não tratado:', err);
  process.exit(1);
});

/**
 * FinMemory — agente de promoções (Cloud Run Job / cron local)
 *
 * Uso:
 *   node jobs/agent.js <supermercado> [store_key]
 *
 * Exemplos:
 *   node jobs/agent.js dia
 *   node jobs/agent.js dia sp-centro
 *
 * Env obrigatório:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 *
 * DIA (obrigatório para chain dia):
 *   DIA_STORE_URL — URL da página da loja (ex.: https://dia.com.br/lojas/...)
 * Opcional:
 *   STORE_LAT, STORE_LNG — se não vier, geocodifica store_name (Mapbox, mesmo token do app)
 *   USE_PLAYWRIGHT=1 — tenta Playwright se fetch falhar
 *
 * Regra de ouro (combinada com o app):
 *   Job diário (24h) · TTL de exibição 72h (expira_em) · sem DELETE em massa (só ativo=false no lote antigo)
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { createClient } = require('@supabase/supabase-js');
const OpenAIModule = require('openai');
const OpenAI = OpenAIModule.default || OpenAIModule;
const { buildDiaOffersExtractionPrompt } = require('../lib/diaOffersGptPrompt.js');

const TTL_MS = 72 * 60 * 60 * 1000;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function extractJsonPayload(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function stripHtmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asNumberBR(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const cleaned = s
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

async function geocodeAddress(query) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !query || String(query).trim().length < 2) return null;
  const q = encodeURIComponent(String(query).trim());
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${token}&limit=1&country=BR`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features && data.features[0];
    if (!feature || !feature.center || feature.center.length < 2) return null;
    const [lng, lat] = feature.center;
    return { lat: Number(lat), lng: Number(lng) };
  } catch (e) {
    console.warn('Geocode error:', e.message);
    return null;
  }
}

async function fetchHtmlWithOptionalPlaywright(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FinMemory-PromoBot/1.0',
    Accept: 'text/html,application/xhtml+xml',
  };
  const res = await fetch(url, { headers });
  if (res.ok) return res.text();

  if (process.env.USE_PLAYWRIGHT !== '1') {
    throw new Error(`fetch falhou: ${res.status} (defina USE_PLAYWRIGHT=1 para tentar Chromium)`);
  }

  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: headers['User-Agent'] });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}

async function scrapeDia({ storeUrl }) {
  const openai = getOpenAI();
  if (!openai) throw new Error('OPENAI_API_KEY não configurada');

  const html = await fetchHtmlWithOptionalPlaywright(storeUrl);
  const text = stripHtmlToText(html);
  const truncated = text.slice(0, 25000);

  const extractionPrompt = buildDiaOffersExtractionPrompt(truncated);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: extractionPrompt }],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const raw = completion?.choices?.[0]?.message?.content || '';
  let jsonStr = extractJsonPayload(raw) || raw;
  const parsed = JSON.parse(jsonStr);

  const storeName = String(parsed?.store_name || '').trim();
  const offers = Array.isArray(parsed?.offers) ? parsed.offers : [];
  if (!storeName) throw new Error('store_name não foi extraído');

  let lat = process.env.STORE_LAT != null ? Number(process.env.STORE_LAT) : null;
  let lng = process.env.STORE_LNG != null ? Number(process.env.STORE_LNG) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const coords = await geocodeAddress(`${storeName}, Brasil`);
    if (!coords) throw new Error('Não foi possível obter lat/lng (STORE_LAT/LNG ou Mapbox)');
    lat = coords.lat;
    lng = coords.lng;
  }

  return { store_name: storeName, offers, lat, lng };
}

async function scrapeStub(chain) {
  throw new Error(
    `jobs/agent.js só implementa a rede "dia" (OpenAI). Para Atacadão, Assaí, Carrefour, etc., use o agente completo na raiz do repo: npm run agent:supermercados (ou: node finmemory-agent/agent.js --only=${chain}).`
  );
}

async function run() {
  const supermercado = (process.argv[2] || '').toLowerCase().trim();
  const storeKey = (process.argv[3] || 'default').trim() || 'default';

  if (!supermercado) {
    console.error('Uso: node jobs/agent.js <supermercado> [store_key]');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const runId = new Date().toISOString();
  const expiraEm = new Date(Date.now() + TTL_MS).toISOString();

  let payload;
  if (supermercado === 'dia') {
    const storeUrl = process.env.DIA_STORE_URL;
    if (!storeUrl || !String(storeUrl).trim()) {
      throw new Error('Para dia, defina DIA_STORE_URL (página da loja no site DIA)');
    }
    payload = await scrapeDia({ storeUrl: storeUrl.trim() });
  } else {
    payload = await scrapeStub(supermercado);
  }

  const { store_name, offers, lat, lng } = payload;

  const rows = offers
    .map((o) => {
      const product_name = String(o?.product_name || '').trim();
      const promo_price =
        typeof o?.promo_price === 'number' ? o.promo_price : asNumberBR(o?.promo_price);
      if (!product_name || promo_price == null || promo_price <= 0) return null;
      return {
        supermercado,
        store_key: storeKey,
        store_name,
        product_name,
        price: promo_price,
        lat,
        lng,
        run_id: runId,
        atualizado_em: runId,
        expira_em: expiraEm,
        ativo: true,
        ingest_source: 'job_openai_dia',
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    console.log(JSON.stringify({ ok: true, supermercado, storeKey, inserted: 0, note: 'nenhuma oferta válida' }));
    return;
  }

  const { error: deactivateErr } = await supabase
    .from('promocoes_supermercados')
    .update({ ativo: false })
    .eq('supermercado', supermercado)
    .eq('store_key', storeKey)
    .eq('ativo', true);

  if (deactivateErr) {
    throw new Error(`Falha ao desativar lote anterior: ${deactivateErr.message}`);
  }

  const { error: insertErr } = await supabase.from('promocoes_supermercados').insert(rows);

  if (insertErr) {
    throw new Error(`Falha ao inserir promoções: ${insertErr.message}`);
  }

  console.log(
    JSON.stringify({
      ok: true,
      supermercado,
      storeKey,
      run_id: runId,
      expira_em: expiraEm,
      inserted: rows.length,
      store_name,
    })
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

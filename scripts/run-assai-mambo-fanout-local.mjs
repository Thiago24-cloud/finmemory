#!/usr/bin/env node
/**
 * Assaí + Mambo → pins "Assaí — *" / "Mambo — *" via enqueueScraperRun (local, Anthropic não usado).
 * Uso: node scripts/run-assai-mambo-fanout-local.mjs
 */
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { enqueueScraperRun } from '../apps/consumer/lib/ingest/enqueueScraperRun.js';

config({ path: resolve(process.cwd(), '.env.local') });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(url, key);

function nextSundayYmd() {
  const tz = 'America/Sao_Paulo';
  const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  const ymdFmt = new Intl.DateTimeFormat('fr-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const base = Date.now();
  for (let i = 0; i < 14; i++) {
    const d = new Date(base + i * 86400000);
    if (weekdayFmt.format(d) === 'Sun') return ymdFmt.format(d);
  }
  return ymdFmt.format(new Date(base));
}

function parsePriceBR(text) {
  const m = String(text || '').match(/R\$\s*([\d.]+,\d{2}|\d+)/i);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function loadPins(prefix) {
  const { data, error } = await supabase
    .from('stores')
    .select('id,name,address,lat,lng')
    .ilike('name', `${prefix}%`)
    .eq('active', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(80);
  if (error) throw new Error(error.message);
  return (data || []).filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)));
}

async function scrapeMambo(page) {
  const urls = [
    'https://www.mambo.com.br/lista-rapida',
    'https://www.mambo.com.br/ofertas',
    'https://www.mambo.com.br/',
  ];
  const items = [];
  const seen = new Set();
  for (const u of urls) {
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForTimeout(3500);
      await page.evaluate(async () => {
        for (let i = 0; i < 6; i++) {
          window.scrollBy(0, 900);
          await new Promise((r) => setTimeout(r, 400));
        }
      });
      const chunk = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('a,div,li,article').forEach((el) => {
          const text = (el.innerText || '').trim();
          if (!text || text.length < 8 || text.length > 220) return;
          if (!/R\$\s*[\d.,]+/.test(text)) return;
          const nome =
            el.querySelector('h2,h3,h4,[class*="name"],[class*="Name"],[class*="title"]')
              ?.innerText?.trim() || text.split('\n').find((l) => l && !/R\$/.test(l));
          const precoTxt = text.match(/R\$\s*[\d.]+,\d{2}/)?.[0] || text.match(/R\$\s*[\d.,]+/)?.[0];
          const imagem = el.querySelector('img')?.src || null;
          if (nome && precoTxt) out.push({ nome: nome.slice(0, 160), precoTxt, imagem });
        });
        return out;
      });
      for (const it of chunk) {
        const preco = parsePriceBR(it.precoTxt);
        if (!preco || !it.nome) continue;
        const k = `${it.nome}|${preco}`;
        if (seen.has(k)) continue;
        seen.add(k);
        items.push({ nome: it.nome, preco, imagem_url: it.imagem });
      }
      if (items.length >= 12) break;
    } catch (e) {
      console.warn('mambo page', u, e.message);
    }
  }
  return items.slice(0, 40);
}

async function scrapeAssai(page) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const validUntil = nextSundayYmd();

  try {
    await page.goto('https://www.assai.com.br/ofertas', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await page.waitForTimeout(2000);
    const fromJson = await page.evaluate(async () => {
      const res = await fetch('/sites/default/files/static/ofertas_assai.json', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return { ok: false, status: res.status };
      const j = await res.json();
      return { ok: true, ofertas: j?.ofertas || [] };
    });

    const imageUrls = [];
    if (fromJson?.ok && Array.isArray(fromJson.ofertas)) {
      for (const oferta of fromJson.ofertas.slice(0, 8)) {
        const images = Array.isArray(oferta?.images) ? oferta.images : [];
        for (const img of images.slice(0, 2)) {
          const srcRaw = img?.url || img?.src || '';
          if (!srcRaw) continue;
          const imagem = String(srcRaw).startsWith('http')
            ? String(srcRaw)
            : `https://www.assai.com.br${srcRaw}`;
          imageUrls.push(imagem);
        }
      }
    }
    console.log('Assaí encarte images', imageUrls.length);

    if (apiKey && imageUrls.length) {
      const { extractOffersViaVision } = await import(
        '../apps/consumer/lib/diaScraper/scraperDiaCore.js'
      );
      const ofertas = await extractOffersViaVision(apiKey, imageUrls.slice(0, 12), validUntil, {
        provider: 'anthropic',
      });
      const items = [];
      for (const o of ofertas || []) {
        const nome = String(o?.nome || '').trim();
        const preco = Number(o?.preco_promocional ?? o?.preco);
        if (!nome || !Number.isFinite(preco) || preco <= 0) continue;
        items.push({
          nome: nome.slice(0, 160),
          preco,
          imagem_url: imageUrls[0] || null,
        });
      }
      if (items.length) return items.slice(0, 40);
    }
  } catch (e) {
    console.warn('assai vision/json', e.message);
  }

  // cards na página
  await page.evaluate(async () => {
    for (let i = 0; i < 8; i++) {
      window.scrollBy(0, 1000);
      await new Promise((r) => setTimeout(r, 350));
    }
  });
  const cards = await page.evaluate(() => {
    const out = [];
    const sel =
      '[class*="product"],[class*="Product"],[class*="offer"],[class*="card"],a[href*="produto"]';
    document.querySelectorAll(sel).forEach((card) => {
      const text = (card.innerText || '').trim();
      if (!/R\$\s*[\d.,]+/.test(text)) return;
      const nome =
        card.querySelector('h2,h3,h4,[class*="name"],[class*="title"]')?.innerText?.trim() ||
        text.split('\n').find((l) => l && !/R\$/.test(l));
      const precoTxt = text.match(/R\$\s*[\d.]+,\d{2}/)?.[0];
      const imagem = card.querySelector('img')?.src || null;
      if (nome && precoTxt) out.push({ nome: nome.slice(0, 160), precoTxt, imagem });
    });
    return out;
  });
  const items = [];
  const seen = new Set();
  for (const it of cards) {
    const preco = parsePriceBR(it.precoTxt);
    if (!preco) continue;
    const k = `${it.nome}|${preco}`;
    if (seen.has(k)) continue;
    seen.add(k);
    items.push({ nome: it.nome, preco, imagem_url: it.imagem });
  }
  return items.slice(0, 40);
}

async function publishToPins(chainLabel, prefix, origem, produtos) {
  const pins = await loadPins(prefix);
  console.log(`${chainLabel}: ${produtos.length} produtos → ${pins.length} pins`);
  if (!produtos.length || !pins.length) return { ok: 0, fail: 0 };

  const validUntil = nextSundayYmd();
  const mapped = produtos.map((p) => ({
    nome: p.nome,
    preco: p.preco,
    imagem_url: p.imagem_url || null,
    valid_until: validUntil,
  }));

  let ok = 0;
  let fail = 0;
  for (const store of pins) {
    // limpa lote recente da mesma origem neste pin
    await supabase
      .from('price_points')
      .delete()
      .eq('source', origem)
      .eq('store_name', store.name)
      .gte('created_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString());

    const queued = await enqueueScraperRun(supabase, {
      origem,
      storeName: store.name,
      storeAddress: store.address || null,
      storeLat: Number(store.lat),
      storeLng: Number(store.lng),
      localityScope: 'Cidade',
      localityCity: 'São Paulo',
      localityState: 'SP',
      dddCode: '11',
      produtos: mapped,
      artifacts: { batch: 'assai-mambo-fanout-local', pin_id: store.id },
    });
    if (queued.ok) {
      ok += 1;
      console.log('  OK', store.name, 'inserted', queued.inserted);
    } else {
      fail += 1;
      console.warn('  FAIL', store.name, queued.error);
    }
  }
  return { ok, fail };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});

console.log('=== Mambo ===');
const skipMambo = process.argv.includes('--assai-only');
let mamboRes = { ok: 0, fail: 0 };
let mambo = [];
if (!skipMambo) {
  mambo = await scrapeMambo(page);
  console.log('Mambo scraped', mambo.length);
  mamboRes = await publishToPins('Mambo', 'Mambo —', 'scraper_mambo', mambo);
} else {
  console.log('Mambo skipped (--assai-only)');
}

console.log('\n=== Assaí ===');
const assai = await scrapeAssai(page);
console.log('Assaí scraped', assai.length);
const assaiRes = await publishToPins('Assaí', 'Assaí —', 'scraper_assai', assai);

await browser.close();

console.log('\n=== RESUMO ===');
console.log('Mambo', mamboRes, 'produtos', mambo.length);
console.log('Assaí', assaiRes, 'produtos', assai.length);
process.exit(mamboRes.fail || assaiRes.fail ? 1 : 0);

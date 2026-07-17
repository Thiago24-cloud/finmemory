#!/usr/bin/env node
/**
 * Publica ofertas Sonda no mapa via anon key (sem service role).
 * Uso: node scripts/publish-sonda-anon-cloudrun.mjs [--only=pompeia]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import {
  SCRAPER_SONDA_ORIGEM,
  extractSondaOffersForStoreCep,
  fetchSondaPhysicalStoresFromSite,
  mapSondaOffersToProdutosFila,
  matchUnitToPhysicalStore,
  nextSundayYmdBrazil,
} from '../apps/consumer/lib/sondaScraper/scraperSondaCore.js';

const anon = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').match(
  /NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/
)?.[1]?.trim();
const url = 'https://faxqrkxqfwjdavorxien.supabase.co';
const BOT = '30ecc42b-2006-4754-a2da-7f012f2ef5e2';
if (!anon) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local');
  process.exit(1);
}

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).toLowerCase() : 'pompeia';

const headers = {
  apikey: anon,
  Authorization: `Bearer ${anon}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

async function getStoreCoords(storeName) {
  const r = await fetch(
    `${url}/rest/v1/stores?name=eq.${encodeURIComponent(storeName)}&select=name,lat,lng,address&limit=1`,
    { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }
  );
  const rows = await r.json();
  return rows?.[0] || null;
}

async function insertBatch(rows) {
  const r = await fetch(`${url}/rest/v1/price_points`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`insert HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
}

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scripts/sonda-unidades-terminal-ids.json'), 'utf8')
);
let units = (manifest.units || []).filter((u) => !u.pinOnly && !u.skip);
if (only) units = units.filter((u) => u.id.includes(only) || u.label.toLowerCase().includes(only));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const physicalStores = await fetchSondaPhysicalStoresFromSite(page);
const validYmd = nextSundayYmdBrazil();
const now = new Date().toISOString();

for (const unit of units) {
  const storeName = `Sonda — ${unit.label}`;
  console.log('\n===', storeName, '===');
  let cep = String(unit.siteCep || '').replace(/\D/g, '');
  if (!cep) {
    const matched = matchUnitToPhysicalStore(unit, physicalStores);
    if (!matched) {
      console.warn('sem CEP');
      continue;
    }
    cep = matched.cep;
  }
  const raw = await extractSondaOffersForStoreCep(page, cep);
  const produtos = mapSondaOffersToProdutosFila(raw, validYmd).filter(
    (p) => Number.isFinite(Number(p.preco)) && Number(p.preco) > 0
  );
  console.log('produtos', produtos.length, 'cep', cep);
  if (!produtos.length) continue;

  let lat = null;
  let lng = null;
  const st = await getStoreCoords(storeName);
  if (st) {
    lat = Number(st.lat);
    lng = Number(st.lng);
  }
  if (!Number.isFinite(lat) && unit.id === 'pompeia') {
    lat = -23.540168;
    lng = -46.690593;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.warn('sem coords');
    continue;
  }

  const rows = produtos.slice(0, 120).map((p) => ({
    user_id: BOT,
    store_name: storeName,
    lat,
    lng,
    product_name: String(p.nome || p.name).slice(0, 200),
    price: Number(p.preco ?? p.price),
    image_url: p.imagem_url || p.image_url || null,
    category: 'Supermercado - Promoção',
    source: SCRAPER_SONDA_ORIGEM,
    created_at: now,
    expires_at: validYmd,
    locality_state: 'SP',
    locality_city: unit.city || 'São Paulo',
  }));

  for (let i = 0; i < rows.length; i += 40) {
    await insertBatch(rows.slice(i, i + 40));
  }
  console.log('inserted', rows.length, 'at', lat, lng);
}

await browser.close();
console.log('done');

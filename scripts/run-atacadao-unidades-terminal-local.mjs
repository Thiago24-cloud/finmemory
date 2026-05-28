#!/usr/bin/env node
/**
 * Scraper Atacadão local → publica no mapa (mesma região das unidades DIA do terminal).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import {
  fetchAtacadaoScraperStoresFromOfficial,
  resolveAtacadaoScraperStores,
} from '../apps/consumer/lib/atacadaoScraper/fetchAtacadaoCatalogStores.js';
import { ATACADAO_SCRAPER_STORES } from '../apps/consumer/lib/atacadaoScraper/storesCatalog.js';
import {
  SCRAPER_ATACADAO_ORIGEM,
  fetchAllStoreProducts,
  mapVtexProductsToProdutosFila,
  nextSundayYmdBrazil,
  resolveAtacadaoStoreLatLng,
  inferLocalityForCity,
} from '../apps/consumer/lib/atacadaoScraper/scraperAtacadaoCore.js';
import { enqueueScraperRun } from '../apps/consumer/lib/ingest/enqueueScraperRun.js';

config({ path: resolve(process.cwd(), '.env.local') });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scripts/atacadao-unidades-regiao-terminal-ids.json'), 'utf8')
);
const officialIds = (manifest.officialSellerIds || []).map(String);
const legacyIds = manifest.storeIds || [];
const wantCeps = new Set(
  legacyIds
    .map((id) => ATACADAO_SCRAPER_STORES.find((s) => s.id === id)?.cep)
    .filter(Boolean)
);
const supabase = createClient(url, key);
const official = await fetchAtacadaoScraperStoresFromOfficial();
let stores = official.filter(
  (s) => officialIds.includes(String(s.id)) || officialIds.includes(String(s.sellerId))
);
if (!stores.length) {
  stores = official.filter((s) => wantCeps.has(s.cep));
}
if (!stores.length) {
  const fallback = await resolveAtacadaoScraperStores({ storeIds: legacyIds });
  stores = fallback.stores || [];
}
if (!stores.length) {
  console.error('Nenhuma filial Atacadão encontrada para CEPs:', [...wantCeps]);
  process.exit(1);
}
console.log(`Filiais Atacadão: ${stores.length} (catálogo oficial: ${official.length})`);
const runId = randomUUID();
const sundayFallbackYmd = nextSundayYmdBrazil();
const summary = [];

for (const store of stores) {
  const row = { id: store.id, storeName: store.storeName, ok: false };
  console.log('\n==========', store.storeName, '==========');
  try {
    const coords = await resolveAtacadaoStoreLatLng(store);
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      row.error = 'geocoding';
      summary.push(row);
      continue;
    }
    const { products: vtexProducts } = await fetchAllStoreProducts(store.cep);
    if (!vtexProducts?.length) {
      row.error = 'VTEX vazio';
      summary.push(row);
      continue;
    }
    const produtos = mapVtexProductsToProdutosFila(vtexProducts, store.cnpj, sundayFallbackYmd);
    if (!produtos.length) {
      row.error = 'sem produtos com preço+imagem';
      row.vtexTotal = vtexProducts.length;
      summary.push(row);
      continue;
    }
    const loc = inferLocalityForCity(store.city);
    const queued = await enqueueScraperRun(supabase, {
      origem: SCRAPER_ATACADAO_ORIGEM,
      storeName: store.storeName,
      storeAddress: store.addressForGeocode,
      storeLat: coords.lat,
      storeLng: coords.lng,
      localityScope: loc.locality_scope,
      localityCity: loc.locality_city,
      localityRegion: loc.locality_region,
      localityState: loc.locality_state,
      dddCode: loc.ddd_code,
      isStatewide: loc.is_statewide,
      produtos,
      artifacts: { cep: store.cep, run_id: runId, batch: 'atacadao-unidades-terminal' },
    });
    if (!queued.ok) {
      row.error = queued.error;
      summary.push(row);
      continue;
    }
    row.ok = true;
    row.inserted = queued.inserted;
    row.produtos = produtos.length;
    console.log('OK inserted=', queued.inserted);
  } catch (e) {
    row.error = e?.message || String(e);
    console.error('ERRO:', row.error);
  }
  summary.push(row);
  await new Promise((r) => setTimeout(r, 1500));
}

console.log('\n=== RESUMO ATACADÃO ===');
console.log(JSON.stringify(summary, null, 2));
const ok = summary.filter((s) => s.ok).length;
console.log(`Sucesso: ${ok}/${summary.length}`);
process.exit(ok === summary.length ? 0 : 1);

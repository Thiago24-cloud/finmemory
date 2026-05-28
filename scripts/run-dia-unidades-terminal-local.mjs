#!/usr/bin/env node
/**
 * Scraper DIA local → publica direto no mapa (Supabase produção).
 * Mesmas unidades que scripts/dia-unidades-terminal-ids.json
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { resolveDiaScraperStores } from '../apps/consumer/lib/diaScraper/fetchDiaCatalogStores.js';
import {
  extractOffersViaVision,
  fetchDiaPageDataJson,
  mapOfertasToProdutosFila,
  nextSundayYmdBrazil,
  resolveStoreLatLng,
  toIsoDateOnly,
  inferLocalityForCity,
  SCRAPER_DIA_ORIGEM,
} from '../apps/consumer/lib/diaScraper/scraperDiaCore.js';
import { enqueueScraperRun } from '../apps/consumer/lib/ingest/enqueueScraperRun.js';

config({ path: resolve(process.cwd(), '.env.local') });
config();

const apiKey = process.env.ANTHROPIC_API_KEY;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!apiKey || !url || !key) {
  console.error('Faltam ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).toLowerCase() : '';
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/dia-unidades-terminal-ids.json'), 'utf8'));
let ids = manifest.storeIds || [];
if (only) ids = ids.filter((id) => id.toLowerCase().includes(only));

const supabase = createClient(url, key);
const { stores: allStores } = await resolveDiaScraperStores({ storeIds: ids });
const runId = randomUUID();
const sundayFallbackYmd = nextSundayYmdBrazil();
const summary = [];

for (const store of allStores) {
  const row = { id: store.id, storeName: store.storeName, ok: false };
  console.log('\n==========', store.storeName, '==========');
  try {
    const coords = await resolveStoreLatLng(store);
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      row.error = 'geocoding';
      summary.push(row);
      continue;
    }
    const pageData = await fetchDiaPageDataJson(store.storeUrl);
    const tabloide = pageData?.result?.data?.tabloide;
    if (!tabloide) {
      row.error = 'sem tabloide';
      summary.push(row);
      continue;
    }
    const offerItems = Array.isArray(tabloide.offer) ? tabloide.offer : [];
    const finishDateIso = toIsoDateOnly(tabloide.finishDate) || sundayFallbackYmd;
    const imageUrls = offerItems
      .map((o) => {
        const src = o?.image?.childImageSharp?.gatsbyImageData?.images?.fallback?.src;
        return src ? `https://www.dia.com.br${src}` : null;
      })
      .filter(Boolean);
    if (!imageUrls.length) {
      row.error = 'sem imagens';
      summary.push(row);
      continue;
    }
    const ofertas = await extractOffersViaVision(apiKey, imageUrls, finishDateIso);
    const produtos = mapOfertasToProdutosFila(ofertas, sundayFallbackYmd, imageUrls, new Date().toISOString());
    if (!produtos.length) {
      row.error = 'sem produtos extraídos';
      summary.push(row);
      continue;
    }
    const loc = inferLocalityForCity(store.city);
    const queued = await enqueueScraperRun(supabase, {
      origem: SCRAPER_DIA_ORIGEM,
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
      artifacts: { source_page_url: store.storeUrl, run_id: runId, batch: 'dia-unidades-terminal' },
    });
    if (!queued.ok) {
      row.error = queued.error;
      summary.push(row);
      continue;
    }
    row.ok = true;
    row.inserted = queued.inserted;
    row.produtos = produtos.length;
    console.log('OK inserted=', queued.inserted, 'produtos=', produtos.length);
  } catch (e) {
    row.error = e?.message || String(e);
    console.error('ERRO:', row.error);
  }
  summary.push(row);
  await new Promise((r) => setTimeout(r, 2000));
}

console.log('\n=== RESUMO DIA ===');
console.log(JSON.stringify(summary, null, 2));
const ok = summary.filter((s) => s.ok).length;
console.log(`Sucesso: ${ok}/${summary.length}`);
process.exit(ok === summary.length ? 0 : 1);

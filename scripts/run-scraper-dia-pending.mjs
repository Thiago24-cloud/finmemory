#!/usr/bin/env node
/**
 * Executa scraper DIA (unidades do catálogo) e publica no mapa automaticamente.
 *
 * Uso:
 *   node -r dotenv/config scripts/run-scraper-dia-pending.mjs
 *   node -r dotenv/config scripts/run-scraper-dia-pending.mjs --store-id=fradique-1256
 *   node -r dotenv/config scripts/run-scraper-dia-pending.mjs --http
 *
 * --http  chama POST /api/scraper/dia no app (cron igual produção).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { resolveDiaScraperStores } from '../lib/diaScraper/fetchDiaCatalogStores.js';
import {
  extractOffersViaVision,
  fetchDiaPageDataJson,
  insertApprovedFilaAndPublishScraperDia,
  mapOfertasToProdutosFila,
  nextSundayYmdBrazil,
  resolveStoreLatLng,
  toIsoDateOnly,
  inferLocalityForCity,
  SCRAPER_DIA_ORIGEM,
} from '../lib/diaScraper/scraperDiaCore.js';
import { resolveOwnerUserId } from '../lib/botPromoOwner.js';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const storeArg = process.argv.find((a) => a.startsWith('--store-id='));
const storeId = storeArg ? storeArg.split('=')[1] : null;
const useHttp = process.argv.includes('--http');
const runAll = process.argv.includes('--all');

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Defina ANTHROPIC_API_KEY no .env.local');
  process.exit(1);
}

const { stores: catalogStores, catalogTotal } = await resolveDiaScraperStores({
  storeIds: storeId ? [storeId] : undefined,
  all: runAll,
  batchSize: runAll ? undefined : 1,
});
const store = catalogStores[0];
if (!store) {
  console.error('Loja não encontrada:', storeId || '(primeira do lote)');
  console.error('Catálogo total:', catalogTotal);
  process.exit(1);
}

if (useHttp) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    'http://localhost:3000';
  const secret = process.env.DIA_IMPORT_SECRET || process.env.CRON_SECRET;
  const url = `${base}/api/scraper/dia${secret ? `?secret=${encodeURIComponent(secret)}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-cron-secret': secret } : {}),
    },
    body: JSON.stringify({ storeIds: [store.id] }),
  });
  const json = await res.json().catch(() => ({}));
  console.log(JSON.stringify(json, null, 2));
  process.exit(res.ok ? 0 : 1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);
const runId = randomUUID();
const sundayFallbackYmd = nextSundayYmdBrazil();

const ownerUserId = await resolveOwnerUserId(supabase, null);
if (!ownerUserId) {
  console.error('Configure BOT_PROMO_OWNER_USER_ID ou MAP_QUICK_ADD_BOT_USER_ID');
  process.exit(2);
}

console.log(`Scraper DIA → mapa automático | loja: ${store.storeName} (${store.id})`);

const coords = await resolveStoreLatLng(store);
if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
  console.error('Geocoding falhou');
  process.exit(2);
}

const pageData = await fetchDiaPageDataJson(store.storeUrl);
const tabloide = pageData?.result?.data?.tabloide;
if (!tabloide) {
  console.error('page-data sem tabloide');
  process.exit(3);
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
  console.error('Nenhuma imagem de oferta');
  process.exit(4);
}

const ofertas = await extractOffersViaVision(apiKey, imageUrls, finishDateIso);
const produtos = mapOfertasToProdutosFila(ofertas, sundayFallbackYmd, imageUrls);
if (!produtos.length) {
  console.error('Nenhum produto extraído');
  process.exit(5);
}

const loc = inferLocalityForCity(store.city);
const published = await insertApprovedFilaAndPublishScraperDia(
  supabase,
  {
    store_name: store.storeName,
    store_address: store.addressForGeocode,
    store_lat: coords.lat,
    store_lng: coords.lng,
    locality_scope: loc.locality_scope,
    locality_city: loc.locality_city,
    locality_region: loc.locality_region,
    locality_state: loc.locality_state,
    ddd_code: loc.ddd_code,
    is_statewide: loc.is_statewide,
    produtos,
    artifacts: {
      source_page_url: store.storeUrl,
      run_id: runId,
      cnpj: store.cnpj,
      finish_date: finishDateIso,
      images_found: imageUrls.length,
      origem: SCRAPER_DIA_ORIGEM,
      cli: 'run-scraper-dia-pending.mjs',
    },
  },
  ownerUserId
);

console.log(JSON.stringify(published, null, 2));
if (!published.ok) process.exit(6);

const { count: mapCount } = await supabase
  .from('price_points')
  .select('id', { count: 'exact', head: true })
  .eq('store_name', store.storeName)
  .eq('source', 'scraper_dia')
  .gte('created_at', new Date(Date.now() - 5 * 60_000).toISOString());

console.log(
  `OK — filaId ${published.filaId} | ${published.inserted ?? 0} no mapa | ${produtos.length} extraídos | price_points recentes: ${mapCount ?? 0}`
);

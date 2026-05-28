#!/usr/bin/env node
/**
 * Executa scraper DIA (unidades do catálogo) e enfileira em pendente para aprovação.
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
const normalizeAddress = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const maybeMatchStoreByCoords = async (storeName, lat, lng) => {
  const latMin = lat - 0.012;
  const latMax = lat + 0.012;
  const lngMin = lng - 0.012;
  const lngMax = lng + 0.012;
  const nameToken = String(storeName || 'DIA').slice(0, 40);
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, lat, lng, address')
    .ilike('name', `%${nameToken.split(' ')[0] || 'DIA'}%`)
    .gte('lat', latMin)
    .lte('lat', latMax)
    .gte('lng', lngMin)
    .lte('lng', lngMax)
    .limit(20);
  if (error || !Array.isArray(data) || data.length === 0) return null;
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const row of data) {
    const d = distanceKm(lat, lng, Number(row.lat), Number(row.lng));
    if (d < bestDist) {
      bestDist = d;
      best = row;
    }
  }
  if (!best || bestDist > 0.6) return null;
  return {
    storeId: best.id,
    storeName: best.name,
    lat: Number(best.lat),
    lng: Number(best.lng),
    address: best.address || null,
    distanceKm: Number(bestDist.toFixed(4)),
  };
};

console.log(`Scraper DIA → fila pendente | loja: ${store.storeName} (${store.id})`);

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
const extractedAt = new Date().toISOString();
const produtos = mapOfertasToProdutosFila(ofertas, sundayFallbackYmd, imageUrls, extractedAt);
if (!produtos.length) {
  console.error('Nenhum produto extraído');
  process.exit(5);
}

const storeMatch = await maybeMatchStoreByCoords(store.storeName, coords.lat, coords.lng);
const resolvedStoreName = storeMatch?.storeName || store.storeName;
const resolvedLat = Number.isFinite(storeMatch?.lat) ? storeMatch.lat : coords.lat;
const resolvedLng = Number.isFinite(storeMatch?.lng) ? storeMatch.lng : coords.lng;
const resolvedAddress = normalizeAddress(storeMatch?.address || store.addressForGeocode);
const loc = inferLocalityForCity(store.city);
const queued = await enqueueScraperRun(supabase, {
  origem: SCRAPER_DIA_ORIGEM,
  storeName: resolvedStoreName,
  storeAddress: resolvedAddress,
  storeLat: resolvedLat,
  storeLng: resolvedLng,
  localityScope: loc.locality_scope,
  localityCity: loc.locality_city,
  localityRegion: loc.locality_region,
  localityState: loc.locality_state,
  dddCode: loc.ddd_code,
  isStatewide: loc.is_statewide,
  produtos,
  artifacts: {
    source_page_url: store.storeUrl,
    run_id: runId,
    cnpj: store.cnpj,
    finish_date: finishDateIso,
    images_found: imageUrls.length,
    image_urls: imageUrls,
    origem: SCRAPER_DIA_ORIGEM,
    extracted_at: extractedAt,
    thumbnail_url: imageUrls[0] || null,
    store_address_normalized: resolvedAddress,
    matched_store: storeMatch,
    cli: 'run-scraper-dia-pending.mjs',
  },
});

console.log(JSON.stringify(queued, null, 2));
if (!queued.ok) process.exit(6);

const { data: fila, error: filaErr } = await supabase
  .from('bot_promocoes_fila')
  .select('id, status, origem')
  .eq('id', queued.filaId)
  .maybeSingle();

if (filaErr || !fila) {
  console.error('Não leu fila recém-criada:', filaErr?.message || 'registro ausente');
  process.exit(7);
}

console.log(`OK — filaId ${fila.id} | status ${fila.status} | ${produtos.length} extraídos`);

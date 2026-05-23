#!/usr/bin/env node
/**
 * Cria/atualiza pins em public.stores para todas as lojas DIA e Atacadão do catálogo oficial.
 * Rode após expandir catálogo para o mapa mostrar as unidades mesmo antes do próximo scraper.
 *
 *   node -r dotenv/config scripts/seed-scraper-stores.mjs
 *   node -r dotenv/config scripts/seed-scraper-stores.mjs --dia-only
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { fetchDiaScraperStoresFromOfficial } from '../lib/diaScraper/fetchDiaCatalogStores.js';
import { fetchAtacadaoScraperStoresFromOfficial } from '../lib/atacadaoScraper/fetchAtacadaoCatalogStores.js';
import { geocodeAddress } from '../lib/geocode.js';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const diaOnly = process.argv.includes('--dia-only');
const atacOnly = process.argv.includes('--atacadao-only');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function ensureStore(row) {
  let lat = row.lat;
  let lng = row.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const coords = await geocodeAddress(row.addressForGeocode);
    lat = coords?.lat;
    lng = coords?.lng;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, name: row.storeName, error: 'sem coordenadas' };
  }

  const { error } = await supabase.rpc('find_or_create_store', {
    p_name: row.storeName,
    p_address: row.addressForGeocode || '',
    p_lat: lat,
    p_lng: lng,
  });
  if (error) return { ok: false, name: row.storeName, error: error.message };
  return { ok: true, name: row.storeName };
}

let ok = 0;
let fail = 0;

if (!atacOnly) {
  console.log('DIA — carregando catálogo oficial…');
  const dia = await fetchDiaScraperStoresFromOfficial();
  console.log(`  ${dia.length} lojas SP`);
  for (const store of dia) {
    // eslint-disable-next-line no-await-in-loop
    const r = await ensureStore(store);
    if (r.ok) ok += 1;
    else {
      fail += 1;
      console.warn('  falha:', r.name, r.error);
    }
  }
}

if (!diaOnly) {
  console.log('Atacadão — descobrindo filiais SP (pode levar ~1 min)…');
  const atac = await fetchAtacadaoScraperStoresFromOfficial();
  console.log(`  ${atac.length} filiais SP`);
  for (const store of atac) {
    // eslint-disable-next-line no-await-in-loop
    const r = await ensureStore(store);
    if (r.ok) ok += 1;
    else {
      fail += 1;
      console.warn('  falha:', r.name, r.error);
    }
  }
}

console.log(`Concluído: ${ok} lojas OK, ${fail} falhas.`);

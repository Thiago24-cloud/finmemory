#!/usr/bin/env node
/**
 * Sonda — ofertas por loja física (CEP no site oficial), não catálogo delivery único.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import {
  SCRAPER_SONDA_ORIGEM,
  extractSondaOffersForStoreCep,
  fetchSondaPhysicalStoresFromSite,
  inferLocalityForCity,
  mapSondaOffersToProdutosFila,
  matchUnitToPhysicalStore,
  nextSundayYmdBrazil,
  resolveSondaUnitLatLng,
} from '../apps/consumer/lib/sondaScraper/scraperSondaCore.js';
import { enqueueScraperRun } from '../apps/consumer/lib/ingest/enqueueScraperRun.js';

config({ path: resolve(process.cwd(), '.env.local') });
config();

const cleanup = process.argv.includes('--cleanup-only');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).toLowerCase() : '';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

if (cleanup) {
  const { data, error } = await supabase.from('price_points').delete().eq('source', 'scraper_sonda').select('id');
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log('Removidos price_points scraper_sonda:', data?.length ?? 0);
  process.exit(0);
}

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scripts/sonda-unidades-terminal-ids.json'), 'utf8')
);
let units = manifest.units || [];
if (only) units = units.filter((u) => u.id.includes(only) || u.label.toLowerCase().includes(only));

async function ensureSondaStorePin(supabase, unit) {
  const storeName = `Sonda — ${unit.label}`;
  const coords = await resolveSondaUnitLatLng(unit);
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return { ok: false, error: 'geocoding' };
  }
  const { data: existing } = await supabase.from('stores').select('id').eq('name', storeName).maybeSingle();
  if (existing?.id) {
    const { error } = await supabase
      .from('stores')
      .update({
        lat: coords.lat,
        lng: coords.lng,
        address: unit.address || null,
        type: 'supermarket',
        active: true,
      })
      .eq('id', existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('stores').insert({
      name: storeName,
      type: 'supermarket',
      address: unit.address || null,
      lat: coords.lat,
      lng: coords.lng,
      active: true,
      needs_review: false,
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, lat: coords.lat, lng: coords.lng };
}

console.log('Removendo promoções Sonda antigas…');
if (only) {
  for (const unit of units) {
    if (unit.pinOnly) continue;
    const storeName = `Sonda — ${unit.label}`;
    await supabase.from('price_points').delete().eq('source', 'scraper_sonda').eq('store_name', storeName);
  }
} else {
  const { error: delErr } = await supabase.from('price_points').delete().eq('source', 'scraper_sonda');
  if (delErr) {
    console.error('Falha ao limpar:', delErr.message);
    process.exit(1);
  }
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();

console.log('Carregando lojas físicas do site…');
const physicalStores = await fetchSondaPhysicalStoresFromSite(page);
console.log(`Lojas no site: ${physicalStores.length}`);

const validYmd = nextSundayYmdBrazil();
const summary = [];

for (const unit of units) {
  const row = { id: unit.id, label: unit.label, ok: false };
  const storeName = `Sonda — ${unit.label}`;
  console.log('\n==========', storeName, '==========');

  if (unit.skip) {
    row.skipped = true;
    row.error = unit.skipReason || 'unidade ignorada';
    summary.push(row);
    continue;
  }

  if (unit.pinOnly) {
    try {
      const pin = await ensureSondaStorePin(supabase, unit);
      if (!pin.ok) {
        row.error = pin.error;
      } else {
        row.ok = true;
        row.pinOnly = true;
        console.log('PIN ONLY (sem promo do site)', unit.pinOnlyReason || '');
      }
    } catch (e) {
      row.error = e?.message || String(e);
    }
    summary.push(row);
    continue;
  }

  let cep = String(unit.siteCep || '').replace(/\D/g, '');
  let matchedAddress = unit.siteAddressNote || null;
  if (!cep) {
    const matched = matchUnitToPhysicalStore(unit, physicalStores);
    if (!matched) {
      row.error = 'loja não encontrada em Lojas Físicas do site';
      console.warn(row.error, unit.address);
      summary.push(row);
      continue;
    }
    cep = matched.cep;
    matchedAddress = matched.addressLine;
  }
  row.matchedAddress = matchedAddress;
  row.cep = cep;

  try {
    const raw = await extractSondaOffersForStoreCep(page, cep);
    const produtos = mapSondaOffersToProdutosFila(raw, validYmd);
    if (!produtos.length) {
      row.error = `0 produtos para CEP ${cep}`;
      summary.push(row);
      continue;
    }

    const coords = await resolveSondaUnitLatLng(unit);
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      row.error = 'geocoding';
      summary.push(row);
      continue;
    }

    const loc = inferLocalityForCity(unit.city);
    const queued = await enqueueScraperRun(supabase, {
      origem: SCRAPER_SONDA_ORIGEM,
      storeName,
      storeAddress: unit.address,
      storeLat: coords.lat,
      storeLng: coords.lng,
      localityScope: loc.locality_scope,
      localityCity: loc.locality_city,
      localityRegion: loc.locality_region,
      localityState: loc.locality_state,
      dddCode: loc.ddd_code,
      isStatewide: loc.is_statewide,
      produtos,
      artifacts: {
        source: 'sonda.com.br/ofertas',
        physical_store_line: matchedAddress,
        cep,
        unit_id: unit.id,
        match_quality: unit.matchQuality || 'proximate',
        user_address: unit.address,
      },
    });

    if (!queued.ok) {
      row.error = queued.error;
      summary.push(row);
      continue;
    }
    row.ok = true;
    row.inserted = queued.inserted;
    row.produtos = produtos.length;
    console.log('OK CEP', cep, 'inserted', queued.inserted, 'produtos', produtos.length);
  } catch (e) {
    row.error = e?.message || String(e);
    console.error('ERRO:', row.error);
  }
  summary.push(row);
  await new Promise((r) => setTimeout(r, 1500));
}

await browser.close();

console.log('\n=== RESUMO SONDA (por loja física) ===');
console.log(JSON.stringify(summary, null, 2));
const ok = summary.filter((s) => s.ok).length;
const failed = summary.filter((s) => !s.ok && !s.skipped);
console.log(`Sucesso: ${ok}/${summary.length}`, failed.length ? `falhas: ${failed.length}` : '');
process.exit(failed.length ? 1 : 0);

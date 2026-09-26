#!/usr/bin/env node
/**
 * Geocodifica as 75 unidades, casa DIA/Atacadão por proximidade, upsert em public.stores.
 * Uso: node -r dotenv/config scripts/sync-unidades-mapa-sp-pins.mjs
 *      (dotenv carrega .env; também lemos .env.local)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  geocodeAddress,
  GRANDE_SP_GEOCODE_BBOX,
  SAO_PAULO_CITY_PROXIMITY,
} from '../apps/consumer/lib/geocode.js';
import { fetchDiaScraperStoresFromOfficial } from '../apps/consumer/lib/diaScraper/fetchDiaCatalogStores.js';
import { fetchAtacadaoScraperStoresFromOfficial } from '../apps/consumer/lib/atacadaoScraper/fetchAtacadaoCatalogStores.js';

config({ path: resolve(process.cwd(), '.env.local') });
config();

const MAX_DIA_KM = 2.2;
const MAX_ATAC_KM = 3.5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function geocodeUnit(chainLabel, unit) {
  const queries = [
    `${chainLabel} ${unit.address}, Brasil`,
    `${unit.address}, Brasil`,
    `${chainLabel} ${unit.label}, São Paulo, SP, Brasil`,
  ];
  const opts = { bbox: GRANDE_SP_GEOCODE_BBOX, proximity: SAO_PAULO_CITY_PROXIMITY };
  for (const q of queries) {
    const coords = await geocodeAddress(q, opts);
    await sleep(120);
    if (!coords) continue;
    if (coords.lat < -24.2 || coords.lat > -22.7 || coords.lng < -47.2 || coords.lng > -45.9) {
      continue;
    }
    return coords;
  }
  return null;
}

function nearestStore(coords, stores, maxKm, getLatLng) {
  let best = null;
  for (const s of stores) {
    const ll = getLatLng(s);
    if (!ll || !Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)) continue;
    const km = haversineKm(coords, ll);
    if (km > maxKm) continue;
    if (!best || km < best.km) best = { store: s, km };
  }
  return best;
}

function labelMatchAtacadao(unit, stores) {
  const label = norm(unit.label).replace(/\s*\/\s*/g, ' ');
  const aliases = {
    'marginal pinheiros': ['morumbi', 'sylvio', 'padilha', 'marginal'],
    'freguesia do o': ['freguesia', 'otaviano'],
    'sao mateus': ['sao mateus', 'ragueb', 'mateus'],
    'cidade tiradentes': ['tiradentes', 'iguacu', 'iguacu'],
    'secco anhanguera': ['anhanguera', 'jaragua', 'secco'],
    butanta: ['butanta', 'raposo'],
    jabaquara: ['jabaquara', 'armando'],
    penha: ['penha', 'robiano', 'elisabeth'],
    pirituba: ['pirituba', 'raimundo'],
    'santo amaro': ['santo amaro', 'nacoes'],
    'vila maria': ['vila maria', 'morvan'],
    interlagos: ['interlagos'],
    itaquera: ['itaquera', 'jacu'],
    'sao miguel': ['sao miguel', 'marechal tito'],
    'campo limpo': ['campo limpo'],
  };
  const keys = aliases[label] || [label];
  let best = null;
  for (const s of stores) {
    const hay = norm(`${s.storeName} ${s.id} ${s.city || ''}`);
    let score = 0;
    for (const k of keys) {
      if (hay.includes(k)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { store: s, score };
  }
  return best && best.score >= 1 ? best : null;
}

const list = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scripts/unidades-mapa-sp-2026-07.json'), 'utf8')
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  console.error('Falta NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN');
  process.exit(1);
}

const supabase = createClient(url, key);

console.log('Catálogo DIA…');
const diaStores = await fetchDiaScraperStoresFromOfficial();
console.log(`DIA ${diaStores.length}`);

console.log('Catálogo Atacadão…');
const atacStores = await fetchAtacadaoScraperStoresFromOfficial();
console.log(`Atacadão ${atacStores.length}`);

/** Geocode Atacadão store names once for proximity fallback */
const atacWithCoords = [];
for (const s of atacStores) {
  const coords = await geocodeAddress(
    `${s.storeName}, ${s.city || 'São Paulo'}, SP, Brasil`,
    { bbox: GRANDE_SP_GEOCODE_BBOX, proximity: SAO_PAULO_CITY_PROXIMITY }
  );
  await sleep(100);
  atacWithCoords.push({ ...s, lat: coords?.lat ?? null, lng: coords?.lng ?? null });
  process.stdout.write('.');
}
console.log(`\nAtacadão geocoded ${atacWithCoords.filter((s) => s.lat).length}/${atacWithCoords.length}`);

const chainMeta = {
  mambo: { prefix: 'Mambo', type: 'supermarket' },
  sonda: { prefix: 'Sonda', type: 'supermarket' },
  atacadao: { prefix: 'Atacadão', type: 'supermarket' },
  dia: { prefix: 'DIA', type: 'supermarket' },
  assai: { prefix: 'Assaí', type: 'supermarket' },
};

const result = {
  generatedAt: new Date().toISOString(),
  pins: [],
  dia: { matched: [], unmatched: [] },
  atacadao: { matched: [], unmatched: [] },
};

async function upsertPin(storeName, address, lat, lng) {
  const { data: existing } = await supabase.from('stores').select('id').eq('name', storeName).maybeSingle();
  const payload = {
    name: storeName,
    type: 'supermarket',
    address: address || null,
    lat,
    lng,
    active: true,
    needs_review: false,
  };
  if (existing?.id) {
    const { error } = await supabase.from('stores').update(payload).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id, updated: true };
  }
  const { data, error } = await supabase.from('stores').insert(payload).select('id').single();
  if (error) throw new Error(error.message);
  return { id: data.id, updated: false };
}

for (const [chain, units] of Object.entries(list.chains)) {
  const meta = chainMeta[chain];
  console.log(`\n=== ${meta.prefix} (${units.length}) ===`);
  for (const unit of units) {
    const storeName = `${meta.prefix} — ${unit.label}`;
    const coords = await geocodeUnit(meta.prefix, unit);
    if (!coords) {
      console.log(`  ✗ geocode ${unit.label}`);
      result.pins.push({ chain, ...unit, ok: false, error: 'geocode' });
      continue;
    }

    let pinLat = coords.lat;
    let pinLng = coords.lng;
    let matchInfo = null;

    if (chain === 'dia') {
      const near = nearestStore(coords, diaStores, MAX_DIA_KM, (s) =>
        Number.isFinite(s.lat) && Number.isFinite(s.lng) ? { lat: s.lat, lng: s.lng } : null
      );
      if (near) {
        pinLat = near.store.lat;
        pinLng = near.store.lng;
        matchInfo = {
          storeId: near.store.id,
          storeUrl: near.store.storeUrl,
          storeName: near.store.storeName,
          km: Number(near.km.toFixed(3)),
        };
        result.dia.matched.push({ ...unit, ...matchInfo, userLat: coords.lat, userLng: coords.lng });
        console.log(`  ✓ ${unit.label} → ${near.store.id} (${near.km.toFixed(2)} km)`);
      } else {
        result.dia.unmatched.push({ ...unit, userLat: coords.lat, userLng: coords.lng });
        console.log(`  ~ ${unit.label} pin only (sem DIA ≤${MAX_DIA_KM}km)`);
      }
    }

    if (chain === 'atacadao') {
      let matched = labelMatchAtacadao(unit, atacWithCoords);
      if (!matched) {
        const near = nearestStore(coords, atacWithCoords, MAX_ATAC_KM, (s) =>
          Number.isFinite(s.lat) && Number.isFinite(s.lng) ? { lat: s.lat, lng: s.lng } : null
        );
        if (near) matched = { store: near.store, km: near.km, score: 0 };
      }
      if (matched?.store) {
        const s = matched.store;
        if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
          pinLat = s.lat;
          pinLng = s.lng;
        }
        matchInfo = {
          storeId: s.id,
          sellerId: s.sellerId || s.id,
          storeName: s.storeName,
          cep: s.cep || null,
          km: matched.km != null ? Number(matched.km.toFixed(3)) : null,
          labelScore: matched.score ?? null,
        };
        result.atacadao.matched.push({ ...unit, ...matchInfo, userLat: coords.lat, userLng: coords.lng });
        console.log(`  ✓ ${unit.label} → seller ${matchInfo.sellerId}`);
      } else {
        result.atacadao.unmatched.push({ ...unit, userLat: coords.lat, userLng: coords.lng });
        console.log(`  ~ ${unit.label} pin only`);
      }
    }

    try {
      const up = await upsertPin(storeName, unit.address, pinLat, pinLng);
      result.pins.push({
        chain,
        ...unit,
        ok: true,
        storeName,
        lat: pinLat,
        lng: pinLng,
        storeRowId: up.id,
        match: matchInfo,
      });
      console.log(`    pin ${up.updated ? 'upd' : 'new'} ${storeName}`);
    } catch (e) {
      console.log(`    pin ERR ${e.message}`);
      result.pins.push({ chain, ...unit, ok: false, error: e.message, lat: pinLat, lng: pinLng });
    }
  }
}

const outPath = resolve(process.cwd(), 'scripts/unidades-mapa-sp-2026-07.matched.json');
writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

const diaIds = [...new Set(result.dia.matched.map((m) => m.storeId))];
writeFileSync(
  resolve(process.cwd(), 'scripts/dia-unidades-mapa-sp-2026-07-ids.json'),
  JSON.stringify(
    {
      description: 'DIA — IDs oficiais casados por proximidade à lista 2026-07',
      storeIds: diaIds,
      unmatched: result.dia.unmatched.map((u) => ({ id: u.id, label: u.label, address: u.address })),
    },
    null,
    2
  ),
  'utf8'
);

const sellerIds = [...new Set(result.atacadao.matched.map((m) => String(m.sellerId).replace(/^atacadaobr/i, '')))];
writeFileSync(
  resolve(process.cwd(), 'scripts/atacadao-unidades-mapa-sp-2026-07-ids.json'),
  JSON.stringify(
    {
      description: 'Atacadão — sellerIds casados à lista 2026-07',
      officialSellerIds: sellerIds,
      unmatched: result.atacadao.unmatched.map((u) => ({ id: u.id, label: u.label, address: u.address })),
    },
    null,
    2
  ),
  'utf8'
);

const sondaUnits = result.pins
  .filter((p) => p.chain === 'sonda' && p.ok)
  .map((p) => ({
    id: p.id,
    label: p.label,
    address: p.address,
    city: 'São Paulo',
    lat: p.lat,
    lng: p.lng,
  }));
writeFileSync(
  resolve(process.cwd(), 'scripts/sonda-unidades-mapa-sp-2026-07.json'),
  JSON.stringify(
    {
      description: 'Sonda — unidades 2026-07 (pins geocodificados; CEP resolvido no scraper)',
      units: sondaUnits,
    },
    null,
    2
  ),
  'utf8'
);

const mamboLojas = result.pins
  .filter((p) => p.chain === 'mambo' && p.ok)
  .map((p) => ({
    slug: p.id,
    name: `Mambo ${p.label}`,
    address: p.address,
    neighborhood: p.label,
    lat: p.lat,
    lng: p.lng,
    place_id: `manual-mambo-${p.id}`,
  }));
writeFileSync(
  resolve(process.cwd(), 'data/curadoria/mambo-sp-lojas.json'),
  JSON.stringify(mamboLojas, null, 2),
  'utf8'
);

console.log('\n=== RESUMO ===');
console.log(`pins ok: ${result.pins.filter((p) => p.ok).length}/${result.pins.length}`);
console.log(`DIA matched: ${result.dia.matched.length}/15`);
console.log(`Atacadão matched: ${result.atacadao.matched.length}/15`);
console.log('Wrote', outPath);

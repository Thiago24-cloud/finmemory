#!/usr/bin/env node
/**
 * Alinha pin + ofertas Sonda: re-geocode, atualiza price_points, garante public.stores.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolveSondaUnitLatLng } from '../apps/consumer/lib/sondaScraper/scraperSondaCore.js';

config({ path: resolve(process.cwd(), '.env.local') });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Supabase env missing');
  process.exit(1);
}

const supabase = createClient(url, key);
const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scripts/sonda-unidades-terminal-ids.json'), 'utf8')
);

const summary = [];

for (const unit of manifest.units || []) {
  const storeName = `Sonda — ${unit.label}`;
  const coords = await resolveSondaUnitLatLng(unit);
  const row = { id: unit.id, storeName, coords };

  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    row.error = 'geocode failed';
    summary.push(row);
    continue;
  }

  const { data: existing } = await supabase.from('stores').select('id').eq('name', storeName).maybeSingle();
  if (existing?.id) {
    const { error: storeUpdErr } = await supabase
      .from('stores')
      .update({
        lat: coords.lat,
        lng: coords.lng,
        address: unit.address || null,
        type: 'supermarket',
        active: true,
      })
      .eq('id', existing.id);
    if (storeUpdErr) row.storeError = storeUpdErr.message;
    else row.storeAction = 'updated';
  } else {
    const { error: insErr } = await supabase.from('stores').insert({
      name: storeName,
      type: 'supermarket',
      address: unit.address || null,
      lat: coords.lat,
      lng: coords.lng,
      active: true,
      needs_review: false,
    });
    if (insErr) row.storeError = insErr.message;
    else row.storeAction = 'inserted';
  }

  if (!unit.pinOnly) {
    const { error: ptErr, count } = await supabase
      .from('price_points')
      .update({ lat: coords.lat, lng: coords.lng })
      .eq('source', 'scraper_sonda')
      .eq('store_name', storeName);
    if (ptErr) row.pointsError = ptErr.message;
    else row.pointsUpdated = count;
  }

  row.ok = !row.storeError && !row.pointsError;
  summary.push(row);
  console.log(row.ok ? 'OK' : 'ERR', storeName, coords.lat.toFixed(5), coords.lng.toFixed(5));
}

console.log(JSON.stringify(summary, null, 2));

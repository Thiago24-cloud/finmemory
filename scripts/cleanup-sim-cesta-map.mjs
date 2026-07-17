#!/usr/bin/env node
/**
 * Remove ofertas simuladas `[sim-cesta]` de price_points (poluem o mapa).
 * Uso: node -r dotenv/config scripts/cleanup-sim-cesta-map.mjs
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { isSimulatedMapProductName } from '../apps/consumer/lib/mapSimulatedOffers.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL e chave Supabase');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

let total = 0;
for (let round = 0; round < 100; round++) {
  const { data, error } = await supabase
    .from('price_points')
    .select('id, product_name')
    .ilike('product_name', '%[sim-cesta]%')
    .limit(200);
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (!data?.length) break;
  const ids = data.filter((r) => isSimulatedMapProductName(r.product_name)).map((r) => r.id);
  if (!ids.length) break;
  const { error: delErr, count } = await supabase.from('price_points').delete({ count: 'exact' }).in('id', ids);
  if (delErr) {
    console.error(delErr.message);
    process.exit(1);
  }
  total += count ?? ids.length;
  console.log(`round ${round + 1}: removed ${count ?? ids.length}`);
}

console.log(JSON.stringify({ ok: true, removed: total }));

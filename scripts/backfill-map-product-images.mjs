#!/usr/bin/env node
/**
 * Rebusca imagens para price_points com miniatura ruim/ausente (nome + preço + Gemini/CSE).
 * Uso: node scripts/backfill-map-product-images.mjs [--source=scraper_sonda] [--limit=50]
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fetchExternalProductImageResolved } from '../apps/consumer/lib/externalProductImages.js';
import { needsThumbnailEnrichment } from '../apps/consumer/lib/enrichMapPointImages.js';

config({ path: resolve(process.cwd(), '.env.local') });
config();

const sourceArg = process.argv.find((a) => a.startsWith('--source='));
const source = sourceArg ? sourceArg.slice('--source='.length) : null;
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : 80;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Supabase env missing');
  process.exit(1);
}

const supabase = createClient(url, key);
const useCse =
  process.env.MAP_POINTS_GOOGLE_CSE_FALLBACK !== '0' &&
  Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID);

let q = supabase
  .from('price_points')
  .select('id, product_name, price, store_name, image_url, source')
  .ilike('category', '%promo%')
  .order('created_at', { ascending: false })
  .limit(Math.min(500, Math.max(limit, 10)));

if (source) q = q.eq('source', source);

const { data: rows, error } = await q;
if (error) {
  console.error(error.message);
  process.exit(1);
}

const todo = (rows || []).filter((r) => needsThumbnailEnrichment(r.image_url)).slice(0, limit);
console.log(`A processar: ${todo.length} / ${rows?.length ?? 0} (limit ${limit})`);

let ok = 0;
let fail = 0;

for (const row of todo) {
  const name = String(row.product_name || '').trim();
  if (!name) continue;
  const { url: imgUrl } = await fetchExternalProductImageResolved(
    name,
    row.store_name || '',
    useCse,
    { price: row.price != null ? Number(row.price) : null }
  );
  if (!imgUrl) {
    fail++;
    console.log('SKIP', name.slice(0, 50));
    continue;
  }
  const { error: upErr } = await supabase
    .from('price_points')
    .update({ image_url: imgUrl })
    .eq('id', row.id);
  if (upErr) {
    fail++;
    console.log('ERR', upErr.message);
  } else {
    ok++;
    console.log('OK', name.slice(0, 45), imgUrl.slice(0, 60));
  }
  await new Promise((r) => setTimeout(r, 400));
}

console.log(`\nConcluído: ${ok} atualizados, ${fail} sem imagem`);

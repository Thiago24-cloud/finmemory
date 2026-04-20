#!/usr/bin/env node
/**
 * Lista produtos do catálogo sem imagem principal (product_images is_primary)
 * e nomes recentes em price_points sem map_product_image_cache.
 *
 * Uso (na raiz do repo):
 *   node scripts/list-products-without-image.mjs
 *
 * Requer no ambiente: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnvFile(name) {
  try {
    const p = resolve(process.cwd(), name);
    const raw = readFileSync(p, 'utf8');
    for (const line of raw.split('\n')) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* optional */
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key);

function normKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

async function main() {
  const { data: products, error: pErr } = await supabase.from('products').select('id, name, gtin').limit(500);
  if (pErr) throw pErr;
  const { data: primaries, error: iErr } = await supabase
    .from('product_images')
    .select('product_id')
    .eq('is_primary', true);
  if (iErr) throw iErr;
  const has = new Set((primaries || []).map((r) => r.product_id));
  const missing = (products || []).filter((p) => p.id && !has.has(p.id));

  console.log('--- Catálogo: produtos sem imagem principal ---');
  if (!missing.length) console.log('(nenhum)');
  else missing.slice(0, 80).forEach((p) => console.log(`- ${p.name}\t${p.id}${p.gtin ? `\tGTIN ${p.gtin}` : ''}`));

  const { data: pts } = await supabase
    .from('price_points')
    .select('product_name')
    .order('created_at', { ascending: false })
    .limit(600);
  const seen = new Set();
  const names = [];
  for (const r of pts || []) {
    const n = String(r.product_name || '').trim();
    if (n.length < 2) continue;
    const k = normKey(n);
    if (seen.has(k)) continue;
    seen.add(k);
    names.push(n);
  }
  const keys = names.map(normKey).filter((k) => k.length >= 2);
  const { data: caches } = await supabase.from('map_product_image_cache').select('norm_key').in('norm_key', keys);
  const cached = new Set((caches || []).map((c) => c.norm_key));
  const mapMissing = names.filter((n, i) => !cached.has(normKey(n))).slice(0, 80);

  console.log('\n--- Mapa: nomes sem repositório (map_product_image_cache) ---');
  if (!mapMissing.length) console.log('(nenhum nos últimos price_points)');
  else mapMissing.forEach((n) => console.log(`- ${n}`));

  console.log('\nPainel: /admin/product-image-curator');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

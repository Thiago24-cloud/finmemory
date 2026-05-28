#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleApiKey = process.env.GOOGLE_API_KEY;
const googleCseId = process.env.GOOGLE_CSE_ID;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!googleApiKey || !googleCseId) {
  console.error('Faltam GOOGLE_API_KEY ou GOOGLE_CSE_ID');
  process.exit(1);
}

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const uniqueLimit = Math.max(1, Math.min(500, Number(limitArg?.split('=')[1] || 120)));

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

function normalizeKey(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function isHttpsImage(url) {
  const t = String(url || '').trim();
  return /^https:\/\//i.test(t) && !/\.(pdf|zip)(\?|$)/i.test(t);
}

async function fetchGoogleImage(productName) {
  const name = String(productName || '').trim();
  const words = name.split(/\s+/).filter(Boolean);
  const short3 = words.slice(0, 3).join(' ');
  const short5 = words.slice(0, 5).join(' ');
  const queries = [
    `${name} atacadao produto embalagem fundo branco`,
    `${name} produto embalagem`,
    `${short5} produto`,
    `${short3} produto`,
  ].filter((q, idx, arr) => q && arr.indexOf(q) === idx);

  for (const query of queries) {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', googleApiKey);
    url.searchParams.set('cx', googleCseId);
    url.searchParams.set('q', query);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('imgType', 'photo');
    url.searchParams.set('safe', 'active');
    url.searchParams.set('num', '10');
    url.searchParams.set('gl', 'br');
    url.searchParams.set('hl', 'pt-BR');

    // eslint-disable-next-line no-await-in-loop
    const resp = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
    if (!resp.ok) continue;
    // eslint-disable-next-line no-await-in-loop
    const payload = await resp.json().catch(() => ({}));
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const strict = items
      .map((it) => ({
        link: String(it?.link || '').trim(),
        w: Number(it?.image?.width || 0),
        h: Number(it?.image?.height || 0),
      }))
      .filter((it) => isHttpsImage(it.link))
      .filter((it) => !Number.isFinite(it.w) || !Number.isFinite(it.h) || (it.w >= 700 && it.h >= 700))
      .sort((a, b) => b.w * b.h - a.w * a.h);
    if (strict[0]?.link) return strict[0].link;

    const relaxed = items
      .map((it) => String(it?.link || '').trim())
      .filter((link) => isHttpsImage(link));
    if (relaxed[0]) return relaxed[0];
  }

  return null;
}

const { data: rows, error: rowsErr } = await supabase
  .from('price_points')
  .select('id, product_name')
  .eq('source', 'scraper_atacadao')
  .is('image_url', null)
  .order('created_at', { ascending: false })
  .limit(20000);

if (rowsErr) {
  console.error('Erro ao ler price_points:', rowsErr.message);
  process.exit(1);
}

const byName = new Map();
for (const row of rows || []) {
  const name = String(row?.product_name || '').trim();
  if (!name) continue;
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(row.id);
}

const names = Array.from(byName.keys()).slice(0, uniqueLimit);
let updatedGroups = 0;
let updatedRows = 0;

for (const name of names) {
  const norm = normalizeKey(name);
  let imageUrl = null;

  const cache = await supabase
    .from('map_product_image_cache')
    .select('image_url')
    .eq('norm_key', norm)
    .maybeSingle();
  if (!cache.error && cache.data?.image_url && isHttpsImage(cache.data.image_url)) {
    imageUrl = String(cache.data.image_url).trim();
  }

  if (!imageUrl) {
    // eslint-disable-next-line no-await-in-loop
    imageUrl = await fetchGoogleImage(name);
  }

  if (!imageUrl) continue;

  const ids = byName.get(name) || [];
  const { error: updErr } = await supabase
    .from('price_points')
    .update({ image_url: imageUrl, tentativa_busca_imagem: true })
    .in('id', ids);
  if (!updErr) {
    updatedGroups += 1;
    updatedRows += ids.length;
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      scanned_groups: names.length,
      updated_groups: updatedGroups,
      updated_rows: updatedRows,
      remaining_rows: (rows || []).length - updatedRows,
    },
    null,
    2
  )
);

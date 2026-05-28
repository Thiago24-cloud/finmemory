#!/usr/bin/env node
/**
 * Backfill local (Supabase direto) — evita timeout HTTP. Rápido: sem Gemini refine nem visão por imagem.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  isLowQualityProductImageUrl,
  needsBetterMapProductImage,
} from '../apps/consumer/lib/mapProductImageQuality.js';

const OFF_USER_AGENT = 'FinMemory/1.0 (https://finmemory.com.br; mapa preços)';

function needsThumbnailEnrichment(url) {
  if (!url || typeof url !== 'string') return true;
  if (isLowQualityProductImageUrl(url)) return true;
  const u = url.trim().toLowerCase();
  if (u.includes('.pdf') || /[?&]format=pdf\b/.test(u)) return true;
  return /\/encarte\/|encarte\.|tablo[ií]de|folheto|ofertas\/pdf|\/folheto\//i.test(u);
}

config({ path: resolve(process.cwd(), '.env.local') });
config();

const sourceArg = process.argv.find((a) => a.startsWith('--source='));
const source = sourceArg ? sourceArg.slice('--source='.length) : 'scraper_sonda';
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : 40;
const roundsArg = process.argv.find((a) => a.startsWith('--rounds='));
const rounds = roundsArg ? Number.parseInt(roundsArg.slice('--rounds='.length), 10) : 1;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.GOOGLE_API_KEY;
const cseId = process.env.GOOGLE_CSE_ID;
if (!url || !key) {
  console.error('Supabase env missing');
  process.exit(1);
}

const useCse =
  process.env.MAP_POINTS_GOOGLE_CSE_FALLBACK !== '0' && Boolean(apiKey && cseId);

const supabase = createClient(url, key);

function normName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function fetchOpenFoodFactsImage(name) {
  const terms = String(name || '').trim().slice(0, 120);
  if (terms.length < 3) return null;
  const u = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  u.searchParams.set('search_terms', terms);
  u.searchParams.set('search_simple', '1');
  u.searchParams.set('action', 'process');
  u.searchParams.set('json', '1');
  u.searchParams.set('page_size', '8');
  u.searchParams.set('fields', 'product_name,image_front_small_url,image_front_url,image_url');
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(u, {
        headers: { Accept: 'application/json', 'User-Agent': OFF_USER_AGENT },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  if (!res?.ok) return null;
  const payload = await res.json();
  const wanted = normName(name);
  let best = null;
  let bestScore = 0;
  for (const p of payload?.products || []) {
    const img = p.image_front_small_url || p.image_front_url || p.image_url;
    if (!img || isLowQualityProductImageUrl(img)) continue;
    const pn = normName(p.product_name);
    let score = 0;
    for (const w of wanted.split(/\s+/).filter((x) => x.length > 2)) {
      if (pn.includes(w)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = img;
    }
  }
  return bestScore >= 2 ? best : null;
}

async function googleImageSearch(query) {
  if (!useCse) return null;
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return null;
  const u = new URL('https://www.googleapis.com/customsearch/v1');
  u.searchParams.set('key', apiKey);
  u.searchParams.set('cx', cseId);
  u.searchParams.set('q', q);
  u.searchParams.set('searchType', 'image');
  u.searchParams.set('num', '5');
  u.searchParams.set('safe', 'active');
  const res = await fetch(u, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) return null;
  const data = await res.json();
  for (const it of data.items || []) {
    const link = it.link || it.image?.thumbnailLink;
    if (link && /^https?:\/\//i.test(link) && !isLowQualityProductImageUrl(link)) return link;
  }
  return null;
}

async function resolveImage(name, storeName) {
  const off = await fetchOpenFoodFactsImage(name);
  if (off) return off;
  const q = `${name} supermercado embalagem fundo branco Brasil ${storeName || ''}`.trim();
  return googleImageSearch(q);
}

async function oneRound(roundNum) {
  let q = supabase
    .from('price_points')
    .select('id, product_name, price, store_name, image_url, source')
    .ilike('category', '%promo%')
    .order('created_at', { ascending: false })
    .limit(600);
  if (source) q = q.eq('source', source);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  const todo = (rows || [])
    .filter((r) => {
      const name = String(r.product_name || '').trim();
      if (name.length < 5 || /^por\s*$/i.test(name) || /^\d+\s*%\s*off$/i.test(name)) return false;
      return needsThumbnailEnrichment(r.image_url) || needsBetterMapProductImage(r.image_url);
    })
    .slice(0, limit);

  console.log(`\nRodada ${roundNum}: ${todo.length} produtos`);
  let ok = 0;
  let fail = 0;

  for (const row of todo) {
    const name = String(row.product_name || '').trim();
    if (!name) continue;
    const imgUrl = await resolveImage(name, row.store_name);
    if (!imgUrl) {
      fail++;
      console.log('  SKIP', name.slice(0, 55));
      continue;
    }
    const { error: upErr } = await supabase
      .from('price_points')
      .update({ image_url: imgUrl })
      .eq('id', row.id);
    if (upErr) {
      fail++;
      console.log('  ERR', upErr.message);
    } else {
      ok++;
      console.log('  OK', name.slice(0, 50));
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { ok, fail, todo: todo.length };
}

let totalOk = 0;
let totalFail = 0;
for (let r = 1; r <= rounds; r++) {
  const { ok, fail, todo } = await oneRound(r);
  totalOk += ok;
  totalFail += fail;
  if (todo === 0) break;
}

console.log(`\nTotal: ${totalOk} atualizados, ${totalFail} sem imagem`);

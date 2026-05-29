#!/usr/bin/env node
/**
 * Backfill mapa: nome → Cosmos GET /products?query= → image_url.
 * Requer COSMOS_API_TOKEN no .env.local.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  resolveCosmosImageByProductName,
} from '../apps/consumer/lib/catalog/cosmosApiClient.js';

config({ path: resolve(process.cwd(), '.env.local') });
config();

const sourceArg = process.argv.find((a) => a.startsWith('--source='));
const source = sourceArg ? sourceArg.slice('--source='.length) : 'scraper_sonda';
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : 40;
const roundsArg = process.argv.find((a) => a.startsWith('--rounds='));
const rounds = roundsArg ? Number.parseInt(roundsArg.slice('--rounds='.length), 10) : 10;
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const days = daysArg ? Number.parseInt(daysArg.slice('--days='.length), 10) : 30;
const resetTentativa = process.argv.includes('--reset-tentativa');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cosmosToken = process.env.COSMOS_API_TOKEN?.trim();

if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!cosmosToken || cosmosToken === 'seu_token_aqui') {
  console.error('Defina COSMOS_API_TOKEN no .env.local (token real da API Cosmos).');
  process.exit(1);
}

const supabase = createClient(url, key);
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

function isBadName(name) {
  const n = String(name || '').trim();
  return n.length < 4 || /^por$/i.test(n) || /^\d+\s*%\s*off$/i.test(n);
}

function needsImage(url) {
  const u = String(url || '').trim();
  if (!u) return true;
  if (/sondadelivery\.com\.br/i.test(u)) return true;
  if (!/catalog-products|cdn-cosmos\.bluesoft|openfoodfacts|finmemory\.com\.br/i.test(u)) return true;
  return false;
}

async function fetchCandidates() {
  let q = supabase
    .from('price_points')
    .select('id, product_name, image_url, tentativa_busca_imagem')
    .eq('tentativa_busca_imagem', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(800);
  if (source) q = q.eq('source', source);
  let { data, error } = await q;
  if (error?.message?.includes('tentativa_busca_imagem')) {
    q = supabase
      .from('price_points')
      .select('id, product_name, image_url')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(800);
    if (source) q = q.eq('source', source);
    ({ data, error } = await q);
  }
  if (error) throw new Error(error.message);
  return (data || [])
    .filter((r) => !isBadName(r.product_name) && needsImage(r.image_url))
    .slice(0, limit);
}

if (resetTentativa) {
  let uq = supabase.from('price_points').update({ tentativa_busca_imagem: false }).eq('tentativa_busca_imagem', true);
  if (source) uq = uq.eq('source', source);
  const { data: resetRows, error: resetErr } = await uq.select('id');
  if (resetErr) console.warn('reset:', resetErr.message);
  else console.log('tentativa_busca_imagem reset:', resetRows?.length ?? 0);
}

let totalOk = 0;
let totalFail = 0;

for (let r = 1; r <= rounds; r++) {
  const todo = await fetchCandidates();
  console.log(`\nRodada ${r}: ${todo.length} produtos (Cosmos GET /products?query=)`);
  if (!todo.length) break;

  for (const row of todo) {
    const name = String(row.product_name || '').trim();
    const hit = await resolveCosmosImageByProductName(name);
    if (!hit?.imageUrl) {
      totalFail++;
      await supabase
        .from('price_points')
        .update({ tentativa_busca_imagem: true })
        .eq('id', row.id);
      console.log('  SKIP', name.slice(0, 52));
      continue;
    }
    const { error: upErr } = await supabase
      .from('price_points')
      .update({ image_url: hit.imageUrl, tentativa_busca_imagem: false })
      .eq('id', row.id);
    if (upErr) {
      totalFail++;
      console.log('  ERR', upErr.message);
    } else {
      totalOk++;
      console.log('  OK', name.slice(0, 48));
    }
    await new Promise((res) => setTimeout(res, 500));
  }
}

console.log(`\nTotal: ${totalOk} com imagem Cosmos, ${totalFail} sem match`);

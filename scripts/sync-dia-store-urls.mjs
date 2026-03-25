#!/usr/bin/env node
/**
 * Cruza lojas DIA em `public.stores` com o catálogo oficial
 * (https://www.dia.com.br/page-data/lojas/page-data.json) por distância geográfica
 * e gera snippet de .env + SQL opcional para `promo_page_url`.
 *
 * Uso: node scripts/sync-dia-store-urls.mjs
 * Requer no .env da raiz: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile(name) {
  const p = resolve(root, name);
  if (!existsSync(p)) return;
  const content = readFileSync(p, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    if (process.env[k] !== undefined && name === '.env') continue;
    let v = (m[2] || '').trim().replace(/^["']|["']$/g, '');
    process.env[k] = v;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const DIA_PAGE_DATA = 'https://www.dia.com.br/page-data/lojas/page-data.json';

function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Evita "Chocolândia", "comédia", etc. — não usar só includes('dia'). */
function isDiaStoreName(name) {
  const n = normalizeText(name);
  if (/\b(supermercado|mercado)\s+dia\b|\bdia\s+(supermercado|market|express)\b/.test(n))
    return true;
  return /\bdia\b/.test(n);
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function fetchDiaCatalog() {
  const res = await fetch(DIA_PAGE_DATA, {
    headers: { 'User-Agent': 'Mozilla/5.0 FinMemory-sync-dia/1.0', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`DIA page-data HTTP ${res.status}`);
  const j = await res.json();
  const nodes = j?.result?.data?.lojas?.nodes || [];
  return nodes.map((n) => {
    const lat = parseFloat(String(n.lat ?? '').replace(',', '.'));
    const lng = parseFloat(String(n.lng ?? '').replace(',', '.'));
    const slug = String(n.slug || '').trim();
    return {
      slug,
      url: `https://www.dia.com.br/lojas/${slug.replace(/\/$/, '')}/`,
      lat,
      lng,
      name: n.name,
      city: n.city,
      address: n.address,
    };
  }).filter((x) => x.slug && Number.isFinite(x.lat) && Number.isFinite(x.lng));
}

function findBestDiaMatch(dbLat, dbLng, catalog, maxKm) {
  let best = null;
  let bestKm = Infinity;
  for (const c of catalog) {
    const km = haversineKm(dbLat, dbLng, c.lat, c.lng);
    if (km < bestKm && km <= maxKm) {
      bestKm = km;
      best = c;
    }
  }
  return best ? { node: best, km: bestKm } : null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Defina NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no .env ou .env.local');
    process.exit(1);
  }

  console.error('Baixando catálogo DIA…');
  const catalog = await fetchDiaCatalog();
  console.error(`  ${catalog.length} lojas no JSON do site.`);

  const supabase = createClient(url, key);
  let rows;
  let error;
  ({ data: rows, error } = await supabase
    .from('stores')
    .select('id, name, lat, lng, promo_page_url')
    .eq('active', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(8000));
  if (error && /promo_page_url/.test(String(error.message))) {
    console.error('Aviso: coluna promo_page_url ausente — aplique a migração 20260325180000; usando só id, name, lat, lng.');
    ({ data: rows, error } = await supabase
      .from('stores')
      .select('id, name, lat, lng')
      .eq('active', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .limit(8000));
  }
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const diaRows = (rows || []).filter((r) => isDiaStoreName(r.name));
  console.error(`  ${diaRows.length} pin(s) em stores com nome parecendo DIA.`);

  const maxKm = Number(process.env.DIA_MATCH_MAX_KM || 1.2);
  const lines = [];
  const sql = [];
  const unmatched = [];

  lines.push('# Gerado por: node scripts/sync-dia-store-urls.mjs');
  lines.push('# Copie para .env ou .env.local (raiz) ou para finmemory-agent/.env');
  lines.push('');

  const urls = new Set();
  for (const r of diaRows) {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (r.promo_page_url && String(r.promo_page_url).includes('dia.com.br/lojas/')) {
      const u = String(r.promo_page_url).trim().split('?')[0].replace(/\/$/, '');
      urls.add(u.startsWith('http') ? u : `https://${u}`);
      continue;
    }
    const hit = findBestDiaMatch(lat, lng, catalog, maxKm);
    if (!hit) {
      unmatched.push({ ...r, reason: `sem loja DIA a ≤${maxKm} km` });
      continue;
    }
    const u = hit.node.url.replace(/\/$/, '');
    urls.add(u);
    sql.push(
      `-- ${r.name} (~${hit.km.toFixed(3)} km) → ${hit.node.name} | ${hit.node.city || ''}`
    );
    sql.push(
      `UPDATE public.stores SET promo_page_url = '${u}/' WHERE id = '${r.id}';`
    );
    sql.push('');
  }

  const list = [...urls];
  list.sort();

  if (list.length) {
    lines.push('# Primeira URL (opcional)');
    lines.push(`DIA_STORE_URL=${list[0]}/`);
    lines.push('');
    lines.push('# Lista para o agente (vírgula ou quebra de linha no .env manual)');
    lines.push('DIA_STORE_URLS=' + list.map((u) => `${u}/`).join(','));
  } else {
    lines.push('# Nenhuma URL gerada — cadastre lojas DIA em public.stores ou ajuste DIA_MATCH_MAX_KM');
  }

  const outPath = resolve(root, '.env.dia.generated');
  const sqlPath = resolve(root, 'scripts', 'dia-stores-promo-page-url.sql');

  const envSection = lines.join('\n');
  const sqlSection = [
    '-- Gerado por scripts/sync-dia-store-urls.mjs — rode no SQL Editor do Supabase se quiser persistir promo_page_url',
    '',
    sql.length ? sql.join('\n') : '-- nada a atualizar (já havia promo_page_url ou sem match)',
    '',
    unmatched.length
      ? `-- Sem match geográfico (ajuste nome/coords ou DIA_MATCH_MAX_KM):\n-- ${unmatched.map((u) => `${u.name} (${u.lat},${u.lng})`).join('\n-- ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  writeFileSync(outPath, `${envSection}\n\n# --- Ver também scripts/dia-stores-promo-page-url.sql ---\n`, 'utf8');
  writeFileSync(sqlPath, sqlSection + '\n', 'utf8');
  console.error(`\nEscrito: ${outPath}`);
  console.error(`Escrito: ${sqlPath}`);
  const nUpdates = sql.filter((l) => l.startsWith('UPDATE')).length;
  console.error(`URLs únicas: ${list.length} | SQL UPDATEs: ${nUpdates} | Sem match: ${unmatched.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

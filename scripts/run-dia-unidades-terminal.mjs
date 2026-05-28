#!/usr/bin/env node
/**
 * Roda o scraper DIA nas mesmas unidades listadas no terminal (scripts/dia-unidades-terminal-ids.json).
 *
 * Uso:
 *   node -r dotenv/config scripts/run-dia-unidades-terminal.mjs --http
 *   node -r dotenv/config scripts/run-dia-unidades-terminal.mjs --http --only=fradique
 *
 * --http     POST /api/scraper/dia (produção se NEXT_PUBLIC_APP_URL = Cloud Run)
 * --only=X   só lojas cujo id contém X (substring)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const useHttp = process.argv.includes('--http');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).toLowerCase() : '';

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scripts/dia-unidades-terminal-ids.json'), 'utf8')
);
let storeIds = manifest.storeIds || [];
if (only) {
  storeIds = storeIds.filter((id) => id.toLowerCase().includes(only));
}

if (!storeIds.length) {
  console.error('Nenhuma loja após filtro --only=', only);
  process.exit(1);
}

const base =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
  process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
  'http://localhost:3000';
const secret = process.env.DIA_IMPORT_SECRET || process.env.CRON_SECRET;

if (useHttp && !secret) {
  console.error('Defina DIA_IMPORT_SECRET no .env.local (e Cloud Run).');
  process.exit(1);
}

console.log(`Lojas: ${storeIds.length} | modo: ${useHttp ? 'HTTP ' + base : 'local (use --http para produção)'}`);

for (const id of storeIds) {
  console.log('\n---', id, '---');
  if (!useHttp) {
    console.log('Rode com --http ou: node -r dotenv/config scripts/run-scraper-dia-pending.mjs --http --store-id=' + id);
    continue;
  }
  const url = `${base}/api/scraper/dia?secret=${encodeURIComponent(secret)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': secret,
    },
    body: JSON.stringify({ storeIds: [id], storeDelayMs: 400 }),
  });
  const json = await res.json().catch(() => ({}));
  const row = Array.isArray(json.results) ? json.results[0] : json;
  console.log('HTTP', res.status, row?.storeName || row?.error || JSON.stringify(json).slice(0, 200));
  if (!res.ok) process.exitCode = 1;
  await new Promise((r) => setTimeout(r, 3000));
}

console.log('\nConcluído. Abra /mapa na região de cada loja (filtro Só promo).');

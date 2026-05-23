#!/usr/bin/env node
/**
 * Dispara enriquecimento Cosmos → R2 para produtos sem imagem.
 *
 * Uso:
 *   node -r dotenv/config scripts/enrich-product-images.mjs
 *   node -r dotenv/config scripts/enrich-product-images.mjs --fila-id=UUID
 *   node -r dotenv/config scripts/enrich-product-images.mjs --limit=20
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const base =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
  process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
  'http://localhost:3000';

const secret =
  process.env.CATALOG_ENRICH_SECRET ||
  process.env.CRON_SECRET ||
  process.env.DIA_IMPORT_SECRET;

const filaArg = process.argv.find((a) => a.startsWith('--fila-id='));
const filaId = filaArg ? filaArg.split('=')[1] : null;
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 40;

if (!secret) {
  console.error('Defina CATALOG_ENRICH_SECRET ou CRON_SECRET no .env.local');
  process.exit(1);
}

const body = filaId
  ? { filaId, mode: 'bot_fila', limit, async: false }
  : { mode: 'promocoes', limit, async: false };

const res = await fetch(`${base}/api/catalog/enrich-product-images`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-cron-secret': secret,
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text };
}

console.log(JSON.stringify(json, null, 2));
if (!res.ok) process.exit(1);

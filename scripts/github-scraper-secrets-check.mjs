#!/usr/bin/env node
/**
 * Valida URL + secrets dos scrapers (local .env → produção consumer).
 * Uso: node -r dotenv/config scripts/github-scraper-secrets-check.mjs
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const WRONG_HOST = /parceiros\.finmemory|finmemory-retailer|finmemory-parceiros/i;

const consumerBase = (
  process.env.CONSUMER_APP_URL ||
  process.env.FINMEMORY_APP_URL ||
  process.env.APP_URL ||
  ''
)
  .trim()
  .replace(/\/$/, '');

const retailerBase = (process.env.RETAILER_APP_URL || process.env.PARCEIROS_APP_URL || '')
  .trim()
  .replace(/\/$/, '');

function pickConsumerBase() {
  const candidates = [
    consumerBase,
    process.env.NEXT_PUBLIC_CONSUMER_APP_URL,
    'https://finmemory.com.br',
  ].map((v) => String(v || '').trim().replace(/\/$/, ''));
  for (const u of candidates) {
    if (!u.startsWith('http')) continue;
    if (WRONG_HOST.test(u)) continue;
    return u;
  }
  return 'https://finmemory.com.br';
}

const base = pickConsumerBase();
const diaSecret = process.env.DIA_IMPORT_SECRET || process.env.CRON_SECRET || '';
const atacSecret = process.env.ATACADAO_IMPORT_SECRET || diaSecret;

console.log('Consumer (scrapers):', base);
if (retailerBase) {
  console.log('Parceiros (mapa redirect / health):', retailerBase);
  const rh = await fetch(`${retailerBase}/api/health`).then((r) => r.status).catch(() => 0);
  console.log('GET parceiros /api/health →', rh);
}
console.log('DIA_IMPORT_SECRET:', diaSecret ? 'SET' : 'MISSING');
console.log('ATACADAO_IMPORT_SECRET:', process.env.ATACADAO_IMPORT_SECRET ? 'SET' : '(fallback DIA/CRON)');

if (WRONG_HOST.test(process.env.NEXTAUTH_URL || '')) {
  console.warn('\n⚠️  NEXTAUTH_URL aponta para parceiros — NÃO use como APP_URL no GitHub Actions.');
  console.warn('   Use CONSUMER_APP_URL=https://finmemory.com.br e RETAILER_APP_URL=https://parceiros.finmemory.com.br\n');
}

async function probe(path, secret, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'X-Cron-Secret': secret } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const health = await fetch(`${base}/api/health`);
console.log('GET /api/health →', health.status);

if (!diaSecret) {
  console.error('Defina DIA_IMPORT_SECRET no .env.local e no GitHub (Settings → Secrets).');
  process.exit(1);
}

const dia = await probe('/api/scraper/dia', diaSecret, { batchSize: 1, batchIndex: 0 });
console.log('POST /api/scraper/dia (1 loja) →', dia.status, dia.json?.storesOk != null ? `storesOk=${dia.json.storesOk}` : dia.json?.error);

const atac = await probe('/api/scraper/atacadao', atacSecret, { batchSize: 1, batchIndex: 0 });
console.log('POST /api/scraper/atacadao (1 loja) →', atac.status, atac.json?.storesOk != null ? `storesOk=${atac.json.storesOk}` : atac.json?.error);

if (dia.status === 404 || atac.status === 404) {
  console.error('\n❌ HTTP 404 — APP_URL no GitHub provavelmente aponta para parceiros.finmemory.com.br');
  process.exit(1);
}
if (dia.status === 403 || atac.status === 403) {
  console.error('\n❌ HTTP 403 — secret diferente entre GitHub e Cloud Run consumer');
  process.exit(1);
}
if (dia.status !== 200 || atac.status !== 200) {
  process.exit(1);
}
console.log('\n✅ Scrapers OK no consumer — mapa atualiza em finmemory.com.br e parceiros.');
console.log('GitHub Secrets sugeridos:');
console.log('  CONSUMER_APP_URL=' + base);
if (retailerBase) console.log('  RETAILER_APP_URL=' + retailerBase);

#!/usr/bin/env node
/**
 * Dispara scrapers no Cloud Run de produção (sem Vercel).
 * Atacadão: POST /api/scraper/atacadao (batchSize=1).
 * Cleanup sim-cesta: POST /api/scraper/cleanup-sim-cesta (após deploy do endpoint).
 *
 * Uso:
 *   node scripts/run-sp-via-cloudrun-today.mjs
 *   node scripts/run-sp-via-cloudrun-today.mjs --cleanup-only
 *   CONSUMER_APP_URL=https://finmemory.com.br node scripts/run-sp-via-cloudrun-today.mjs
 */
const BASE = (
  process.env.CONSUMER_APP_URL ||
  process.env.FINMEMORY_APP_URL ||
  'https://finmemory-836908221936.southamerica-east1.run.app'
).replace(/\/$/, '');

const SECRET = process.env.CRON_SECRET || process.env.DIA_IMPORT_SECRET || process.env.ATACADAO_IMPORT_SECRET || '';
const cleanupOnly = process.argv.includes('--cleanup-only');
const skipAtacadao = process.argv.includes('--skip-atacadao');

async function post(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (SECRET) headers['x-cron-secret'] = SECRET;
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(180000),
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: r.status, json };
}

async function cleanup() {
  console.log('cleanup-sim-cesta →', BASE);
  const r = await post('/api/scraper/cleanup-sim-cesta', {});
  console.log(JSON.stringify({ status: r.status, ...r.json }));
  return r;
}

async function atacadaoAll() {
  console.log('Atacadão all batches →', BASE);
  // descobrir total
  const probe = await post('/api/scraper/atacadao', { batchSize: 1, batchIndex: 0 });
  const total = Number(probe.json?.catalogTotal) || 64;
  console.log('catalogTotal', total, 'probe', probe.status, probe.json?.results?.[0]?.storeName);
  let ok = 0;
  for (let i = 0; i < total; i++) {
    const r = await post('/api/scraper/atacadao', { batchSize: 1, batchIndex: i });
    const res = r.json?.results?.[0] || {};
    if (res.ok) ok++;
    console.log(JSON.stringify({ i, http: r.status, name: res.storeName, inserted: res.inserted, ok: res.ok }));
  }
  console.log('Atacadão storesOk', ok, '/', total);
}

(async () => {
  if (cleanupOnly) {
    await cleanup();
    return;
  }
  if (!skipAtacadao) await atacadaoAll();
  const c = await cleanup();
  if (c.status === 404) {
    console.log('Endpoint cleanup ainda não está no Cloud Run — faça: npm run deploy:cloud-run');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Roda o scraper DIA para todas as lojas Grande SP (capital + RM, sem interior).
 *
 * Uso:
 *   node -r dotenv/config scripts/run-dia-grande-sp-all.mjs
 *   node -r dotenv/config scripts/run-dia-grande-sp-all.mjs --http
 *   node -r dotenv/config scripts/run-dia-grande-sp-all.mjs --batch-size=20 --max-batches=8
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { fetchDiaScraperStoresFromOfficial } from '../apps/consumer/lib/diaScraper/fetchDiaCatalogStores.js';
import { filterDiaStoresByRegion } from '../apps/consumer/lib/diaScraper/filterDiaStoresRegion.js';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const useHttp = process.argv.includes('--http');
const batchSizeArg = process.argv.find((a) => a.startsWith('--batch-size='));
const maxBatchesArg = process.argv.find((a) => a.startsWith('--max-batches='));
const batchSize = Math.max(1, Math.min(40, Number(batchSizeArg?.split('=')[1] || 25)));
const maxBatches = Math.max(1, Number(maxBatchesArg?.split('=')[1] || 999));

const base =
  process.env.FINMEMORY_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_CONSUMER_APP_URL?.trim() ||
  (process.env.NEXTAUTH_URL?.trim() && !/parceiros\.finmemory/i.test(process.env.NEXTAUTH_URL)
    ? process.env.NEXTAUTH_URL.trim()
    : '') ||
  'https://finmemory.com.br';
const secret = process.env.DIA_IMPORT_SECRET || process.env.CRON_SECRET || '';

async function runHttpBatch(batchIndex) {
  const url = `${base.replace(/\/$/, '')}/api/scraper/dia${secret ? `?secret=${encodeURIComponent(secret)}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(secret ? { 'X-Cron-Secret': secret } : {}) },
    body: JSON.stringify({ batchSize, batchIndex, concurrency: 3, storeDelayMs: 400 }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

async function main() {
  const all = await fetchDiaScraperStoresFromOfficial();
  const grandeSp = filterDiaStoresByRegion(all, 'grande_sp');
  const totalBatches = Math.ceil(grandeSp.length / batchSize);
  const batchesToRun = Math.min(maxBatches, totalBatches);

  console.log(
    JSON.stringify(
      {
        region: 'grande_sp',
        storesTotal: grandeSp.length,
        batchSize,
        totalBatches,
        batchesToRun,
      },
      null,
      2
    )
  );

  let totalOk = 0;
  let totalInserted = 0;
  for (let i = 0; i < batchesToRun; i += 1) {
    console.log(`\n=== lote ${i + 1}/${batchesToRun} ===`);
    // eslint-disable-next-line no-await-in-loop
    const result = useHttp ? await runHttpBatch(i) : await runHttpBatch(i);
    const ok = Number(result.storesOk || 0);
    const inserted = (result.results || []).reduce((s, r) => s + (Number(r.inserted) || 0), 0);
    totalOk += ok;
    totalInserted += inserted;
    console.log(JSON.stringify({ batchIndex: i, storesOk: ok, inserted }, null, 2));
  }

  console.log(
    JSON.stringify({ done: true, storesProcessedOk: totalOk, pricePointsInserted: totalInserted }, null, 2)
  );
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});

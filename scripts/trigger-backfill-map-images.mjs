#!/usr/bin/env node
/** Dispara POST /api/cron/backfill-map-images no app local ou produção. */
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });
config();

const base = (process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const secret = process.env.DIA_IMPORT_SECRET?.trim() || '';
const sourceArg = process.argv.find((a) => a.startsWith('--source='));
const source = sourceArg ? sourceArg.slice('--source='.length) : 'scraper_sonda';
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? limitArg.slice('--limit='.length) : '50';

const url = `${base}/api/cron/backfill-map-images?limit=${limit}&source=${encodeURIComponent(source)}${secret ? `&secret=${encodeURIComponent(secret)}` : ''}`;

console.log('POST', url.replace(secret, '***'));
const res = await fetch(url, {
  method: 'POST',
  headers: secret ? { 'X-Cron-Secret': secret, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
  body: JSON.stringify({ source, limit: Number(limit) }),
});
const text = await res.text();
console.log(res.status, text.slice(0, 2000));

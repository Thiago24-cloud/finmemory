#!/usr/bin/env node
/**
 * Re-sincroniza transações Pluggy para todas as ligações em bank_connections,
 * preenchendo institution_* e credit_* nas linhas de public.transacoes.
 *
 * Requer (em .env ou .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET (ou nomes usados em lib/pluggyEnv)
 *
 * Uso:
 *   node scripts/resync-pluggy-transacoes-institution.mjs
 */

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.resolve(__dirname, '..');

for (const filename of ['.env', '.env.local', '.env.production']) {
  const filePath = path.join(cwd, filename);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false });
  }
}

const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
const { createPluggyServerClient, syncTransactionsForItem } = await import(
  '../lib/pluggySyncTransactions.js'
);

const supabase = getSupabaseAdmin();
const pluggy = createPluggyServerClient();

if (!supabase) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
if (!pluggy) {
  console.error('Falta configuração Pluggy (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET).');
  process.exit(1);
}

const { data: connections, error } = await supabase
  .from('bank_connections')
  .select('user_id, item_id, status')
  .limit(5000);

if (error) {
  console.error('[resync] bank_connections:', error.message);
  process.exit(1);
}

const rows = Array.isArray(connections) ? connections : [];
/** @type {{ user_id: string; item_id: string }[]} */
const unique = [];
const seen = new Set();
for (const r of rows) {
  const uid = String(r?.user_id || '').trim();
  const item = String(r?.item_id || '').trim();
  const st = String(r?.status || '').toUpperCase();
  if (!uid || !item) continue;
  if (st === 'DELETED' || st === 'LOGIN_ERROR') continue;
  const k = `${uid}|${item}`;
  if (seen.has(k)) continue;
  seen.add(k);
  unique.push({ user_id: uid, item_id: item });
}

console.info(`[resync] Ligações Pluggy únicas (ativas/non-deleted-ish): ${unique.length}`);
let ok = 0;
let failures = 0;

for (const { user_id: userId, item_id: itemId } of unique) {
  try {
    const result = await syncTransactionsForItem(supabase, pluggy, userId, itemId, {
      daysBack: 120,
      maxTransactions: 3000,
    });
    console.info(`[resync] OK item=${itemId} user=${userId.slice(0, 8)}…`, result);
    ok += 1;
  } catch (e) {
    failures += 1;
    console.warn(`[resync] FALHA item=${itemId}`, e?.message || e);
  }
}

console.info(`[resync] Concluído: ${ok} sucesso, ${failures} falhas (de ${unique.length} itens).`);
process.exit(failures > 0 && ok === 0 ? 1 : 0);

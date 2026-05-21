#!/usr/bin/env node
/**
 * Apaga todas as linhas vencidas de public.promocoes_supermercados em lotes automáticos.
 * O mapa só usa ativo=true e expira_em > now(); o resto é arquivo morto.
 *
 * Uso:
 *   node -r dotenv/config scripts/run-promocoes-cleanup-expired.mjs
 *   node -r dotenv/config scripts/run-promocoes-cleanup-expired.mjs --dry-run
 *   node -r dotenv/config scripts/run-promocoes-cleanup-expired.mjs --batch=100000
 *
 * Depois, no Supabase SQL Editor (snippet separado):
 *   VACUUM ANALYZE public.promocoes_supermercados;
 */
import { createClient } from '@supabase/supabase-js';

function stripEnv(v) {
  if (v == null) return '';
  const s = String(v).trim();
  if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

const dryRun = process.argv.includes('--dry-run');
const batchArg = process.argv.find((a) => a.startsWith('--batch='));
const batchSize = batchArg ? Math.max(1000, Number.parseInt(batchArg.split('=')[1], 10) || 50000) : 50000;

const url =
  stripEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  stripEnv(process.env.SUPABASE_URL) ||
  '';
const key =
  stripEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
  stripEnv(process.env.SUPABASE_SERVICE_KEY) ||
  '';

if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const nowIso = new Date().toISOString();

async function countExpired() {
  const { count, error } = await supabase
    .from('promocoes_supermercados')
    .select('id', { count: 'exact', head: true })
    .lt('expira_em', nowIso);
  if (error) throw error;
  return count ?? 0;
}

async function countLive() {
  const { count, error } = await supabase
    .from('promocoes_supermercados')
    .select('id', { count: 'exact', head: true })
    .eq('ativo', true)
    .gt('expira_em', nowIso);
  if (error) throw error;
  return count ?? 0;
}

async function deleteOneBatch() {
  const { data: rows, error: selErr } = await supabase
    .from('promocoes_supermercados')
    .select('id')
    .lt('expira_em', nowIso)
    .limit(batchSize);
  if (selErr) throw selErr;
  if (!rows?.length) return 0;

  const ids = rows.map((r) => r.id);
  if (dryRun) return ids.length;

  const { error: delErr } = await supabase.from('promocoes_supermercados').delete().in('id', ids);
  if (delErr) throw delErr;
  return ids.length;
}

async function main() {
  const beforeExpired = await countExpired();
  const beforeLive = await countLive();
  console.log(`Vencidas (expira_em < now): ${beforeExpired}`);
  console.log(`Vivas no mapa (ativo + expira_em > now): ${beforeLive}`);
  console.log(`Modo: ${dryRun ? 'dry-run' : 'DELETE'} | lote: ${batchSize}`);

  if (beforeExpired === 0) {
    console.log('Nada a apagar. Rode VACUUM ANALYZE no SQL Editor se o tamanho ainda estiver alto.');
    return;
  }

  let totalDeleted = 0;
  let round = 0;
  while (true) {
    round += 1;
    const n = await deleteOneBatch();
    if (n === 0) break;
    totalDeleted += n;
    console.log(`  lote ${round}: ${dryRun ? 'simularia' : 'apagou'} ${n} (acumulado ${totalDeleted})`);
  }

  const afterExpired = await countExpired();
  const afterLive = await countLive();
  console.log('');
  console.log(dryRun ? `Simulação: ${totalDeleted} linhas em ${round} lote(s).` : `Apagadas: ${totalDeleted} em ${round} lote(s).`);
  console.log(`Vencidas restantes: ${afterExpired}`);
  console.log(`Vivas no mapa: ${afterLive} (antes ${beforeLive})`);
  if (!dryRun) {
    console.log('');
    console.log('Próximo passo no Supabase SQL Editor (snippet NOVO, só esta linha):');
    console.log('  VACUUM ANALYZE public.promocoes_supermercados;');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

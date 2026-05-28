#!/usr/bin/env node
/**
 * Valida pipeline scraper → bot_promocoes_fila com publicação automática no mapa.
 *
 * Uso:
 *   node -r dotenv/config scripts/test-scraper.mjs
 *   node -r dotenv/config scripts/test-scraper.mjs --dry-run
 *
 * Equivale ao test-scraper.ts pedido no plano (projeto usa .mjs no terminal).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { enqueueScraperRun } from '../apps/consumer/lib/ingest/enqueueScraperRun.js';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const dryRun = process.argv.includes('--dry-run');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (dryRun) {
  console.log('DRY-RUN ativo: validação de payload sem conexão com Supabase.');
}

if (!url || !key) {
  if (dryRun) process.exit(0);
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const payload = {
  storeName: 'Teste Scraper FinMemory',
  storeAddress: 'Rua Teste, São Paulo, SP',
  storeLat: -23.5505,
  storeLng: -46.6333,
  localityScope: 'Grande SP',
  localityCity: 'São Paulo',
  localityRegion: 'Capital',
  localityState: 'SP',
  produtos: [
    {
      nome: 'Produto teste scraper pipeline',
      preco: 9.99,
      imagem_url: null,
      valid_until: '2099-12-31',
    },
  ],
  artifacts: { test_run: true, script: 'test-scraper.mjs' },
  origem: 'test_scraper_cli',
};

if (dryRun) {
  console.log('DRY-RUN — payload válido:', JSON.stringify(payload, null, 2));
  process.exit(0);
}

const beforeMap = new Date(Date.now() - 60_000).toISOString();

const queued = await enqueueScraperRun(supabase, payload);
if (!queued.ok) {
  console.error('enqueuePromocoes falhou:', queued.error);
  process.exit(2);
}

const { data: fila, error: filaErr } = await supabase
  .from('bot_promocoes_fila')
  .select('id, status, origem, produtos')
  .eq('id', queued.filaId)
  .maybeSingle();

if (filaErr || !fila) {
  console.error('Não leu fila:', filaErr?.message);
  process.exit(3);
}

if (fila.status !== 'aprovado') {
  console.error(`Status incorreto: ${fila.status} (esperado aprovado)`);
  process.exit(4);
}

if (!Array.isArray(fila.produtos) || fila.produtos.length < 1) {
  console.error('produtos vazio na fila');
  process.exit(5);
}

const { count: mapCount, error: mapErr } = await supabase
  .from('price_points')
  .select('id', { count: 'exact', head: true })
  .eq('source', 'test_scraper_cli')
  .gte('created_at', beforeMap);

if (mapErr) {
  console.warn('Aviso: não verificou price_points:', mapErr.message);
} else if ((mapCount || 0) === 0) {
  console.error('ERRO: nenhum price_point foi criado pelo fluxo automático');
  process.exit(6);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      filaId: fila.id,
      status: fila.status,
      origem: fila.origem,
      produtos: fila.produtos.length,
      mapaDireto: mapCount ?? 0,
    },
    null,
    2
  )
);

console.log('PASS — scraper publicou automaticamente no mapa.');

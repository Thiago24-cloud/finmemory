#!/usr/bin/env node
/**
 * Teste mínimo do pipeline scraper -> bot_promocoes_fila (status pendente).
 *
 * Uso:
 *   node -r dotenv/config scripts/test-scraper.ts
 *   node -r dotenv/config scripts/test-scraper.ts --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import { enqueuePromocoes } from '../apps/consumer/lib/ingest/enqueuePromocoes.js';

const dryRun = process.argv.includes('--dry-run');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const payload = {
  storeName: 'Teste Scraper TS',
  storeAddress: 'Rua Teste, São Paulo, SP',
  storeLat: -23.5505,
  storeLng: -46.6333,
  localityScope: 'Grande SP' as const,
  localityCity: 'São Paulo',
  localityRegion: 'Capital' as const,
  localityState: 'SP' as const,
  produtos: [
    {
      nome: 'Produto teste scraper ts',
      preco: 7.89,
      imagem_url: 'https://example.com/teste.png',
      valid_until: '2099-12-31',
      metadata: { source: 'test_scraper_ts' },
    },
  ],
  artifacts: {
    test_run: true,
    script: 'test-scraper.ts',
    extracted_at: new Date().toISOString(),
    thumbnail_url: 'https://example.com/teste.png',
  },
  origem: 'test_scraper_ts',
};

if (dryRun) {
  console.log('DRY-RUN ativo: validação de payload sem conexão com Supabase.');
  console.log(JSON.stringify({ dryRun: true, payload }, null, 2));
  process.exit(0);
}

if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const beforeMap = new Date(Date.now() - 60_000).toISOString();
const queued = await enqueuePromocoes(supabase, payload);
if (!queued.ok || !queued.filaId) {
  console.error('enqueuePromocoes falhou:', queued.error || 'filaId ausente');
  process.exit(2);
}

const { data: fila, error: filaErr } = await supabase
  .from('bot_promocoes_fila')
  .select('id, status, origem, produtos')
  .eq('id', queued.filaId)
  .maybeSingle();
if (filaErr || !fila) {
  console.error('Não leu fila:', filaErr?.message || 'registro ausente');
  process.exit(3);
}
if (fila.status !== 'pendente') {
  console.error(`Status incorreto: ${fila.status} (esperado pendente)`);
  process.exit(4);
}

const { count: mapCount, error: mapErr } = await supabase
  .from('price_points')
  .select('id', { count: 'exact', head: true })
  .eq('source', 'test_scraper_ts')
  .gte('created_at', beforeMap);
if (mapErr) {
  console.warn('Aviso: não verificou price_points:', mapErr.message);
} else if ((mapCount || 0) > 0) {
  console.error(`ERRO: ${mapCount} price_points criados direto (deveria ser 0)`);
  process.exit(5);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      filaId: fila.id,
      status: fila.status,
      origem: fila.origem,
      produtos: Array.isArray(fila.produtos) ? fila.produtos.length : 0,
      mapaDireto: mapCount ?? 0,
    },
    null,
    2
  )
);

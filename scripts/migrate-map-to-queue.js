/**
 * Migra price_points legados para bot_promocoes_fila para curadoria no painel.
 *
 * Filtro: source = 'legado' (ou NULL)
 * Origem na fila: 'migracao_mapa_legado'
 *
 * Uso:
 *   node scripts/migrate-map-to-queue.js --dry-run   # apenas conta, nada é inserido
 *   node scripts/migrate-map-to-queue.js              # insere na fila
 *
 * Env necessárias (.env.local ou .env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const SUPERMARKET_DOMAINS = [
  'dia.com.br', 'assai.com', 'carrefour.com.br', 'extra.com.br',
  'paodeacucar.com.br', 'atacadao.com.br', 'bistek.com.br',
  'condor.com.br', 'sams.com.br', 'walmart.com.br',
];

const PRICE_IN_NAME_REGEX = /r\$\s*\d|(?<!\d)\d+[.,]\d{2}(?!\d)/i;

function isSupermarketImageUrl(url) {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return SUPERMARKET_DOMAINS.some((d) => hostname.endsWith(d));
  } catch {
    return false;
  }
}

function classifyProduto(row) {
  const needs_image = !row.image_url;
  const needs_price = row.price == null || Number(row.price) === 0;
  const needs_clean_image = !needs_image && isSupermarketImageUrl(row.image_url);
  const name_has_price = PRICE_IN_NAME_REGEX.test(String(row.product_name || ''));
  return { needs_image, needs_price, needs_clean_image, name_has_price };
}

async function run({ dryRun }) {
  console.log(`\n🔍  Buscando price_points legados${dryRun ? ' [DRY RUN]' : ''}…\n`);

  const { data: rows, error } = await supabase
    .from('price_points')
    .select('id, store_name, lat, lng, product_name, price, image_url, category')
    .or('source.is.null,source.eq.legado')
    .order('store_name');

  if (error) {
    console.error('❌  Erro ao buscar price_points:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('ℹ️   Nenhum registro legado encontrado. Nada a migrar.');
    return;
  }

  // Agrupa por store_name
  const lojaMap = new Map();
  for (const row of rows) {
    const key = String(row.store_name || '').trim() || 'Loja sem nome';
    if (!lojaMap.has(key)) {
      lojaMap.set(key, {
        store_name: key,
        store_lat: row.lat,
        store_lng: row.lng,
        ids: [],
        produtos: [],
        stats: { sem_imagem: 0, preco_zero: 0, imagem_suja: 0, nome_com_preco: 0 },
      });
    }
    const loja = lojaMap.get(key);
    loja.ids.push(row.id);

    const flags = classifyProduto(row);
    loja.produtos.push({
      nome: row.product_name,
      preco: row.price != null ? Number(row.price) : null,
      imagem_url: row.image_url || null,
      categoria: row.category || null,
      needs_image: flags.needs_image,
      needs_price: flags.needs_price,
      needs_clean_image: flags.needs_clean_image,
      name_has_price: flags.name_has_price,
    });

    if (flags.needs_image)       loja.stats.sem_imagem++;
    if (flags.needs_price)       loja.stats.preco_zero++;
    if (flags.needs_clean_image) loja.stats.imagem_suja++;
    if (flags.name_has_price)    loja.stats.nome_com_preco++;
  }

  const lojas = Array.from(lojaMap.values());
  const totalProdutos = rows.length;

  // Tabela de resumo
  console.log(`📦  ${lojas.length} loja(s) — ${totalProdutos} produto(s) legados no total.\n`);
  const COL_W = 36;
  console.log(
    'Loja'.padEnd(COL_W) +
    'Total'.padStart(6) +
    'S/Img'.padStart(7) +
    'S/Preço'.padStart(9) +
    'ImgSuja'.padStart(9) +
    'NomePreço'.padStart(11)
  );
  console.log('─'.repeat(COL_W + 6 + 7 + 9 + 9 + 11));
  for (const l of lojas) {
    console.log(
      l.store_name.slice(0, COL_W - 1).padEnd(COL_W) +
      String(l.produtos.length).padStart(6) +
      String(l.stats.sem_imagem).padStart(7) +
      String(l.stats.preco_zero).padStart(9) +
      String(l.stats.imagem_suja).padStart(9) +
      String(l.stats.nome_com_preco).padStart(11)
    );
  }
  console.log('─'.repeat(COL_W + 6 + 7 + 9 + 9 + 11));

  if (dryRun) {
    console.log('\n🧪  Dry run — nenhuma alteração feita.\n');
    return;
  }

  // Anti-duplicata: busca lojas que já têm entrada pendente com mesma store_name
  const storeNames = lojas.map((l) => l.store_name);
  const { data: existentes } = await supabase
    .from('bot_promocoes_fila')
    .select('store_name')
    .eq('status', 'pendente')
    .eq('origem', 'migracao_mapa_legado')
    .in('store_name', storeNames);

  const jaEnfileiradas = new Set((existentes || []).map((r) => r.store_name));
  const lojasNovas = lojas.filter((l) => !jaEnfileiradas.has(l.store_name));
  const lojasSkipped = lojas.length - lojasNovas.length;

  if (lojasSkipped > 0) {
    console.log(`\n⏭   ${lojasSkipped} loja(s) já têm entrada pendente — ignoradas (anti-duplicata).`);
  }

  if (lojasNovas.length === 0) {
    console.log('ℹ️   Nenhuma loja nova para inserir.\n');
    return;
  }

  console.log(`\n📥  Inserindo ${lojasNovas.length} loja(s) na bot_promocoes_fila…`);
  const filaRows = lojasNovas.map((l) => ({
    store_name: l.store_name,
    store_address: null,
    store_lat: l.store_lat,
    store_lng: l.store_lng,
    produtos: l.produtos,
    origem: 'migracao_mapa_legado',
    status: 'pendente',
  }));

  const { error: insertErr } = await supabase.from('bot_promocoes_fila').insert(filaRows);
  if (insertErr) {
    console.error('❌  Erro ao inserir na fila:', insertErr.message);
    process.exit(1);
  }

  const insertedIds = lojasNovas.flatMap((l) => l.ids);
  console.log(`✅  ${lojasNovas.length} entrada(s) inseridas. Marcando ${insertedIds.length} row(s) como 'legado_enfileirado'…`);

  const BATCH = 500;
  for (let i = 0; i < insertedIds.length; i += BATCH) {
    const batch = insertedIds.slice(i, i + BATCH);
    const { error: updErr } = await supabase
      .from('price_points')
      .update({ source: 'legado_enfileirado' })
      .in('id', batch);
    if (updErr) {
      console.error(`❌  Erro ao marcar lote ${i}–${i + BATCH}:`, updErr.message);
      process.exit(1);
    }
  }

  console.log(`\n🎉  Concluído: ${lojasNovas.length} loja(s), ${insertedIds.length} produto(s) enviados para aprovação.`);
  console.log('    Acesse /admin/bot-fila para aprovar cada loja.\n');
}

run({ dryRun: process.argv.includes('--dry-run') });

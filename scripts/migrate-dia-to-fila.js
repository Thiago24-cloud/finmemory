/**
 * Migra registros do bot Dia de price_points → bot_promocoes_fila.
 *
 * Filtro: category = 'Supermercado - Promoção' AND store_name ILIKE '%Dia%'
 * (Único identificador seguro — o scraper sempre usa essa categoria; fluxos manuais não.)
 *
 * Uso:
 *   node scripts/migrate-dia-to-fila.js
 *
 * Variáveis de ambiente necessárias (ou via .env.local):
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

async function migrateDiaToFila({ dryRun = false } = {}) {
  console.log(`\n🔍  Buscando registros Dia em price_points${dryRun ? ' [DRY RUN]' : ''}…\n`);

  // Busca todos os registros do bot Dia
  const { data: rows, error } = await supabase
    .from('price_points')
    .select('id, store_name, lat, lng, product_name, price, image_url')
    .eq('category', 'Supermercado - Promoção')
    .ilike('store_name', '%Dia%')
    .order('store_name');

  if (error) {
    console.error('❌  Erro ao buscar price_points:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('ℹ️   Nenhum registro encontrado. Nada a migrar.');
    return;
  }

  // Agrupa por loja (store_name + lat + lng)
  const lojaMap = new Map();
  for (const row of rows) {
    const key = `${row.store_name}||${row.lat}||${row.lng}`;
    if (!lojaMap.has(key)) {
      lojaMap.set(key, {
        store_name: row.store_name,
        store_lat: row.lat,
        store_lng: row.lng,
        ids: [],
        produtos: [],
      });
    }
    const loja = lojaMap.get(key);
    loja.ids.push(row.id);
    loja.produtos.push({
      nome: row.product_name,
      preco: row.price != null ? Number(row.price) : null,
      imagem_url: row.image_url || null,
    });
  }

  const lojas = Array.from(lojaMap.values());
  const totalProdutos = rows.length;

  console.log(`📦  Encontradas ${lojas.length} loja(s) — ${totalProdutos} produto(s) no total.\n`);
  for (const loja of lojas) {
    console.log(`  • ${loja.store_name} (${loja.produtos.length} produtos)`);
  }

  if (dryRun) {
    console.log('\n🧪  Dry run — nenhuma alteração feita.');
    return { lojas: lojas.length, produtos: totalProdutos };
  }

  // Insere na fila de aprovação
  console.log('\n📥  Inserindo na bot_promocoes_fila…');
  const filaRows = lojas.map((loja) => ({
    store_name: loja.store_name,
    store_address: null,
    store_lat: loja.store_lat,
    store_lng: loja.store_lng,
    produtos: loja.produtos,
    origem: 'migration_dia_legacy',
    status: 'pendente',
  }));

  const { error: insertErr } = await supabase.from('bot_promocoes_fila').insert(filaRows);
  if (insertErr) {
    console.error('❌  Erro ao inserir na fila:', insertErr.message);
    process.exit(1);
  }
  console.log(`✅  ${lojas.length} entrada(s) inseridas na fila.`);

  // Deleta de price_points
  const allIds = lojas.flatMap((l) => l.ids);
  console.log(`\n🗑   Deletando ${allIds.length} linha(s) de price_points…`);

  // Deleta em lotes de 500 para evitar limite de URL
  const BATCH = 500;
  for (let i = 0; i < allIds.length; i += BATCH) {
    const batch = allIds.slice(i, i + BATCH);
    const { error: delErr } = await supabase
      .from('price_points')
      .delete()
      .in('id', batch);
    if (delErr) {
      console.error(`❌  Erro ao deletar lote ${i}–${i + BATCH}:`, delErr.message);
      process.exit(1);
    }
  }
  console.log(`✅  ${allIds.length} registro(s) deletados de price_points.`);

  console.log(`\n🎉  Migração concluída: ${lojas.length} loja(s), ${totalProdutos} produto(s).`);
  console.log('    Acesse /admin/bot-fila para aprovar cada loja.\n');

  return { lojas: lojas.length, produtos: totalProdutos };
}

migrateDiaToFila({ dryRun: process.argv.includes('--dry-run') });

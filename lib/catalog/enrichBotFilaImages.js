import { processImageSync } from './processImageSync.js';

function needsEnrichment(produto) {
  const url = String(produto?.imagem_url || produto?.image_url || produto?.promo_image_url || '').trim();
  if (url) return false;
  if (produto?.tentativa_busca === true) return false;
  return true;
}

/**
 * Enriquece produtos sem imagem numa entrada da bot_promocoes_fila.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} filaId
 * @param {{ maxProducts?: number }} [options]
 */
export async function enrichBotFilaItemImages(supabase, filaId, options = {}) {
  const maxProducts = Math.min(80, Math.max(1, Number(options.maxProducts) || 40));

  const { data: item, error } = await supabase
    .from('bot_promocoes_fila')
    .select('id, produtos, store_name')
    .eq('id', filaId)
    .maybeSingle();

  if (error || !item) {
    return { ok: false, error: error?.message || 'fila_not_found' };
  }

  const produtos = Array.isArray(item.produtos) ? item.produtos : [];
  const targets = [];
  for (let i = 0; i < produtos.length && targets.length < maxProducts; i += 1) {
    if (needsEnrichment(produtos[i])) {
      targets.push({ index: i, produto: produtos[i] });
    }
  }

  const results = [];
  for (const { index, produto } of targets) {
    // eslint-disable-next-line no-await-in-loop
    const result = await processImageSync(
      supabase,
      {
        ...produto,
        nome: produto.nome || produto.name || produto.product_name,
        persist: { table: 'bot_promocoes_fila', filaId: item.id, index },
      },
      { storeName: item.store_name }
    );
    results.push({ index, ...result });
  }

  const enriched = results.filter((r) => r.status === 'enriched').length;
  const notFound = results.filter((r) => r.status === 'not_found').length;

  return {
    ok: true,
    filaId: item.id,
    tried: targets.length,
    enriched,
    notFound,
    results: results.slice(0, 50),
  };
}

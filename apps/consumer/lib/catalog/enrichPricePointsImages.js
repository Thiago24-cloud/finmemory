import { processImageSync } from './processImageSync.js';
import { isLikelyEnrichableProductName, isCatalogR2PublicUrl } from './catalogImageUrls.js';

/**
 * Enriquece price_points recentes sem imagem (scrapers diários/semanais → mapa).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ limit?: number, days?: number, storeName?: string, source?: string }} [options]
 */
export async function enrichPricePointsImages(supabase, options = {}) {
  const limit = Math.min(200, Math.max(1, Number(options.limit) || 60));
  const days = Math.min(30, Math.max(1, Number(options.days) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('price_points')
    .select('id, product_name, image_url, store_name, source, created_at, tentativa_busca_imagem')
    .eq('tentativa_busca_imagem', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit * 2);

  if (options.storeName) query = query.eq('store_name', options.storeName);
  if (options.source) query = query.eq('source', options.source);

  let { data: rows, error } = await query;

  if (error?.message?.includes('tentativa_busca_imagem')) {
    ({ data: rows, error } = await supabase
      .from('price_points')
      .select('id, product_name, image_url, store_name, source, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit * 2));
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  const candidates = (rows || [])
    .filter((r) => {
      const u = String(r?.image_url || '').trim();
      return !u || !isCatalogR2PublicUrl(u);
    })
    .filter((r) => !r.tentativa_busca_imagem)
    .slice(0, limit);

  const targets = candidates.filter((r) => {
    const u = String(r?.image_url || '').trim();
    if (u && !isCatalogR2PublicUrl(u)) return true;
    return isLikelyEnrichableProductName(r.product_name);
  });
  const results = [];

  for (const row of targets) {
    // eslint-disable-next-line no-await-in-loop
    const result = await processImageSync(
      supabase,
      {
        product_name: row.product_name,
        nome: row.product_name,
        image_url: row.image_url,
        tentativa_busca_imagem: row.tentativa_busca_imagem,
        persist: { table: 'price_points', id: row.id },
      },
      { storeName: row.store_name }
    );
    results.push({ id: row.id, product_name: row.product_name, ...result });
  }

  return {
    ok: true,
    mode: 'price_points',
    days,
    scanned: candidates.length,
    tried: targets.length,
    enriched: results.filter((r) => r.status === 'enriched').length,
    not_found: results.filter((r) => r.status === 'not_found').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    results: results.slice(0, 50),
  };
}

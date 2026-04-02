import { validateNormalizedPromoRun } from './run.js';

/**
 * Substitui pontos promocionais recentes da mesma loja (MVP) e insere o lote atual.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('./run.js').NormalizedPromoRun} run
 * @param {{ botUserId: string, replaceWindowHours?: number, createdAtIso?: string }} options
 * @returns {Promise<{ ok: true, inserted: number } | { ok: false, error: string }>}
 */
export async function writePricePointsPromoRun(supabase, run, options) {
  const err = validateNormalizedPromoRun(run);
  if (err) return { ok: false, error: err };

  const { botUserId, replaceWindowHours = 24, createdAtIso } = options;
  if (!botUserId) return { ok: false, error: 'botUserId obrigatório' };

  const hours = Math.max(1, Math.min(Number(replaceWindowHours) || 24, 168));
  const cutoffIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const at = createdAtIso || new Date().toISOString();

  const { error: delErr } = await supabase
    .from('price_points')
    .delete()
    .eq('store_name', run.storeDisplayName)
    .gte('created_at', cutoffIso)
    .ilike('category', '%promo%');

  if (delErr) {
    return { ok: false, error: delErr.message || 'Falha ao limpar price_points anteriores' };
  }

  const pointsToInsert = run.items.map((item) => ({
    user_id: botUserId,
    product_name: item.productName,
    price: item.price,
    store_name: run.storeDisplayName,
    lat: run.lat,
    lng: run.lng,
    category: run.mapCategory,
    created_at: at,
  }));

  if (pointsToInsert.length === 0) {
    return { ok: true, inserted: 0 };
  }

  const { error: insertErr } = await supabase.from('price_points').insert(pointsToInsert);
  if (insertErr) {
    return { ok: false, error: insertErr.message || 'Erro ao inserir price_points' };
  }

  return { ok: true, inserted: pointsToInsert.length };
}

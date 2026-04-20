/**
 * Lojas que não devem usar o bypass de visibilidade Pomar/Sacolão no mapa.
 * @see supabase/migrations/20260412240000_map_curated_pin_opt_out.sql
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Set<string>>}
 */
export async function fetchCuratedPinOptOutStoreIds(supabase) {
  const { data, error } = await supabase.from('map_curated_pin_opt_out').select('store_id');
  if (error) {
    if (/relation|does not exist|map_curated_pin_opt_out/i.test(error.message || '')) {
      return new Set();
    }
    console.warn('map_curated_pin_opt_out:', error.message);
    return new Set();
  }
  const set = new Set();
  for (const r of data || []) {
    if (r?.store_id) set.add(String(r.store_id));
  }
  return set;
}

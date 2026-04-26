/**
 * Enfileira promoções do bot para aprovação em /admin/bot-fila.
 * Nenhum scraper deve inserir diretamente em price_points — use esta função.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase  cliente com service role
 * @param {{
 *   storeName: string,
 *   storeAddress?: string | null,
 *   storeLat: number,
 *   storeLng: number,
 *   localityScope?: 'Estadual' | 'Grande SP' | 'Cidade',
 *   localityCity?: string | null,
 *   localityRegion?: 'Capital' | 'Interior' | 'Litoral' | null,
 *   localityState?: 'SP',
 *   dddCode?: string | null,
 *   isStatewide?: boolean,
 *   produtos: Array<{ nome: string, preco?: number | null, imagem_url?: string | null }>,
 *   artifacts?: Record<string, unknown>,
 *   origem: string,
 * }} payload
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function enqueuePromocoes(supabase, payload) {
  const {
    storeName,
    storeAddress,
    storeLat,
    storeLng,
    localityScope,
    localityCity,
    localityRegion,
    localityState,
    dddCode,
    isStatewide,
    produtos,
    artifacts,
    origem,
  } = payload;

  if (!storeName || typeof storeName !== 'string') {
    return { ok: false, error: 'storeName é obrigatório' };
  }
  if (!origem || typeof origem !== 'string') {
    return { ok: false, error: 'origem é obrigatória' };
  }
  if (!Array.isArray(produtos) || produtos.length === 0) {
    return { ok: false, error: 'produtos não pode ser vazio' };
  }

  const { error } = await supabase.from('bot_promocoes_fila').insert({
    store_name: storeName,
    store_address: storeAddress || null,
    store_lat: storeLat,
    store_lng: storeLng,
    locality_scope: localityScope || null,
    locality_city: localityCity || null,
    locality_region: localityRegion || null,
    locality_state: localityState || 'SP',
    ddd_code: dddCode || null,
    is_statewide: Boolean(isStatewide),
    produtos,
    artifacts: artifacts && typeof artifacts === 'object' ? artifacts : {},
    origem,
    status: 'pendente',
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

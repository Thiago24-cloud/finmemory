/**
 * Garante vínculos lojista ↔ loja (users.store_id + usuarios_loja).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} storeId
 */
export async function syncMerchantStoreBindings(supabase, userId, storeId) {
  if (!supabase || !userId || !storeId) return;

  const nowIso = new Date().toISOString();

  const { error: userErr } = await supabase.from('users').update({ store_id: storeId }).eq('id', userId);
  if (userErr && !userErr.message?.includes('store_id')) {
    console.warn('[syncMerchantStoreBindings] users.store_id:', userErr.message);
  }

  const { error: ulErr } = await supabase.from('usuarios_loja').upsert(
    { id: userId, loja_id: storeId, cargo: 'dono', updated_at: nowIso },
    { onConflict: 'id' }
  );
  if (ulErr && !ulErr.message?.includes('usuarios_loja')) {
    console.warn('[syncMerchantStoreBindings] usuarios_loja:', ulErr.message);
  }
}

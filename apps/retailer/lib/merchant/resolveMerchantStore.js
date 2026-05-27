import { fetchMerchantStoreRow } from './fetchMerchantStoreRow';

/**
 * Resolve a loja (tenant) do utilizador varejista logado.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function resolveMerchantStore(supabase, userId) {
  if (!supabase || !userId) return null;

  let storeId = null;
  let usuarioLoja = null;
  let profile = null;

  const { data: ulRow, error: ulErr } = await supabase
    .from('usuarios_loja')
    .select('loja_id, cargo')
    .eq('id', userId)
    .maybeSingle();

  if (!ulErr && ulRow?.loja_id) {
    usuarioLoja = ulRow;
    storeId = ulRow.loja_id;
  } else if (ulErr && !String(ulErr.message || '').includes('usuarios_loja')) {
    console.warn('[resolveMerchantStore] usuarios_loja:', ulErr.message);
  }

  const { data: profileRow, error: profileErr } = await supabase
    .from('merchant_store_profiles')
    .select('store_id, business_name, onboarding_status, responsible_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profileErr && profileRow) {
    profile = profileRow;
    if (!storeId) storeId = profileRow.store_id || null;
  } else if (profileErr && !String(profileErr.message || '').includes('merchant_store_profiles')) {
    console.warn('[resolveMerchantStore] merchant_store_profiles:', profileErr.message);
  }

  if (!storeId) {
    const { data: owned, error: ownedErr } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_user_id', userId)
      .limit(1)
      .maybeSingle();

    if (!ownedErr && owned?.id) {
      storeId = owned.id;
    } else if (ownedErr && !String(ownedErr.message || '').includes('owner_user_id')) {
      console.warn('[resolveMerchantStore] stores.owner_user_id:', ownedErr.message);
    }
  }

  if (!storeId) {
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('store_id')
      .eq('id', userId)
      .maybeSingle();

    if (!userErr && userRow?.store_id) {
      storeId = userRow.store_id;
    } else if (userErr && !String(userErr.message || '').includes('store_id')) {
      console.warn('[resolveMerchantStore] users.store_id:', userErr.message);
    }
  }

  if (!storeId) return null;

  const store = await fetchMerchantStoreRow(supabase, storeId);
  if (!store) return null;

  return {
    store,
    profile: profile || null,
    usuarioLoja: usuarioLoja || null,
  };
}

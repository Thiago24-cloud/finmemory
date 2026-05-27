const STORE_SELECT_FULL =
  'id, name, address, lat, lng, active, needs_review, type, owner_user_id, tempo_preparo_medio, cnpj, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_onboarded_at';
const STORE_SELECT_MID =
  'id, name, address, lat, lng, active, needs_review, type, owner_user_id, cnpj, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled';
const STORE_SELECT_MIN = 'id, name, address, lat, lng, active, needs_review, type, cnpj';

function isMissingColumnError(message) {
  const m = String(message || '').toLowerCase();
  return m.includes('does not exist') || m.includes('não existe') || m.includes('column');
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} storeId
 */
export async function fetchMerchantStoreRow(supabase, storeId) {
  const attempts = [STORE_SELECT_FULL, STORE_SELECT_MID, STORE_SELECT_MIN];

  for (const columns of attempts) {
    const { data: store, error } = await supabase.from('stores').select(columns).eq('id', storeId).maybeSingle();
    if (!error && store) return store;
    if (error && !isMissingColumnError(error.message)) {
      console.warn('[fetchMerchantStoreRow]', error.message);
      return null;
    }
  }

  return null;
}

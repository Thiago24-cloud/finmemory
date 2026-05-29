import { resolveMerchantStore } from './resolveMerchantStore';
import { syncMerchantStoreBindings } from './syncMerchantStoreBindings';

/**
 * Resolve loja do varejista; se existir vínculo órfão (profile/owner/store_id), re-sincroniza.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function ensureMerchantStoreLink(supabase, userId) {
  const existing = await resolveMerchantStore(supabase, userId);
  if (existing?.store?.id) return existing;

  let storeId = null;

  const { data: profile, error: profileErr } = await supabase
    .from('merchant_store_profiles')
    .select('store_id, business_name, onboarding_status, responsible_name')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!profileErr && profile?.store_id) {
    storeId = profile.store_id;
  } else if (profileErr) {
    const msg = String(profileErr.message || '');
    if (!msg.includes('PGRST116')) {
      console.warn('[ensureMerchantStoreLink] merchant_store_profiles:', profileErr.message);
    }
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
    } else if (ownedErr?.message?.includes('owner_user_id')) {
      // Migração 20260518160000 ainda não aplicada — ignorar este caminho.
    } else if (ownedErr) {
      console.warn('[ensureMerchantStoreLink] stores.owner_user_id:', ownedErr.message);
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
    } else if (userErr?.message?.includes('store_id')) {
      // Coluna users.store_id ausente.
    } else if (userErr) {
      console.warn('[ensureMerchantStoreLink] users.store_id:', userErr.message);
    }
  }

  if (!storeId) return null;

  await syncMerchantStoreBindings(supabase, userId, storeId);
  return resolveMerchantStore(supabase, userId);
}

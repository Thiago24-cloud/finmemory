import { getSupabaseAdmin } from '../supabaseAdmin';
import { normalizeAccountType, ACCOUNT_TYPE_VAREJISTA } from '../userType';
import { ensureMerchantStoreLink } from './ensureMerchantStoreLink';

/**
 * Garante varejista no banco quando já existe loja vinculada (cadastro em /parceiros).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
async function promoteToVarejistaIfStoreLinked(supabase, userId) {
  const now = new Date().toISOString();
  const patch = {
    account_type: ACCOUNT_TYPE_VAREJISTA,
    account_type_selected_at: now,
    account_type_chosen_explicitly: true,
  };
  let { error } = await supabase.from('users').update(patch).eq('id', userId);
  if (error?.message?.includes('account_type_chosen_explicitly')) {
    ({ error } = await supabase
      .from('users')
      .update({ account_type: ACCOUNT_TYPE_VAREJISTA, account_type_selected_at: now })
      .eq('id', userId));
  }
  if (error) {
    console.warn('[resolveMerchantPanelAccess] promote varejista:', error.message);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {{ user?: { supabaseId?: string; account_type?: string } }} session
 * @returns {Promise<'ok' | 'no_store' | 'need_profile' | 'unavailable'>}
 */
export async function resolveMerchantPanelAccess(supabase, session) {
  const userId = session?.user?.supabaseId;
  if (!userId) return 'need_profile';

  if (!supabase) return 'unavailable';

  const accountType = normalizeAccountType(session.user.account_type);
  const ctx = await ensureMerchantStoreLink(supabase, userId);

  if (ctx?.store?.id) {
    if (accountType !== ACCOUNT_TYPE_VAREJISTA) {
      await promoteToVarejistaIfStoreLinked(supabase, userId);
    }
    return 'ok';
  }

  if (accountType === ACCOUNT_TYPE_VAREJISTA) return 'no_store';
  return 'need_profile';
}

/**
 * @param {{ user?: { supabaseId?: string; account_type?: string } }} session
 */
export async function resolveMerchantPanelAccessFromSession(session) {
  return resolveMerchantPanelAccess(getSupabaseAdmin(), session);
}

import { getSupabaseAdmin } from '../supabaseAdmin';
import { ensureMerchantStoreLink } from './ensureMerchantStoreLink';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {{ user?: { supabaseId?: string; account_type?: string } }} session
 * @returns {Promise<'ok' | 'no_store' | 'need_profile' | 'unavailable'>}
 */
export async function resolveMerchantPanelAccess(supabase, session) {
  const userId = session?.user?.supabaseId;
  if (!userId) return 'need_profile';

  if (!supabase) return 'unavailable';

  const ctx = await ensureMerchantStoreLink(supabase, userId);
  if (ctx?.store?.id) return 'ok';

  return 'no_store';
}

/**
 * @param {{ user?: { supabaseId?: string; account_type?: string } }} session
 */
export async function resolveMerchantPanelAccessFromSession(session) {
  return resolveMerchantPanelAccess(getSupabaseAdmin(), session);
}

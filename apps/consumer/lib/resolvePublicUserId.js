import { normalizeEmail } from './securityPolicy';

/**
 * ID canónico em `public.users` (session.user.supabaseId).
 * Prioriza email na BD — evita JWT com supabaseId antigo que quebra FK em tabelas novas.
 *
 * @param {import('next-auth').Session | null | undefined} session
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<string | null>}
 */
export async function resolvePublicUserId(session, supabase) {
  if (!supabase) return null;

  const email = session?.user?.email ? normalizeEmail(session.user.email) : '';
  if (email) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (!error && data?.id) return String(data.id);
  }

  const cached = session?.user?.supabaseId;
  if (cached) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', cached)
      .maybeSingle();
    if (!error && data?.id) return String(data.id);
  }

  return null;
}

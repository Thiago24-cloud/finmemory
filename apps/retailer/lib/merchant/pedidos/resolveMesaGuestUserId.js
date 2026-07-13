const GUEST_EMAIL = 'mesa-qr-guest@internal.finmemory';

/**
 * Usuário técnico para pedidos anônimos via QR da mesa (FK obrigatória em pedidos_loja).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function resolveMesaGuestUserId(supabase) {
  const fromEnv = String(process.env.MESAS_QR_GUEST_USER_ID || '').trim();
  if (fromEnv) return fromEnv;

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', GUEST_EMAIL)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('users')
    .upsert(
      {
        email: GUEST_EMAIL,
        name: 'Cliente Mesa QR',
        google_id: null,
        access_token: null,
        refresh_token: null,
        token_expiry: null,
        last_sync: new Date(),
      },
      { onConflict: 'email' }
    )
    .select('id')
    .single();

  if (error || !created?.id) {
    throw new Error(error?.message || 'Não foi possível preparar pedido da mesa.');
  }

  return created.id;
}

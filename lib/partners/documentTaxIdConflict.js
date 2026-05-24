/**
 * Verifica se CPF/CNPJ já está em uso por outra conta.
 * O mesmo user pode reutilizar o CPF cadastrado como recuperação (consumidor).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} documentTaxId — só dígitos
 * @param {string} userId
 * @returns {Promise<{ blocked: boolean, reason?: 'merchant_profile' | 'store_cnpj' }>}
 */
export async function documentTaxIdConflict(supabase, documentTaxId, userId) {
  if (!documentTaxId || !userId) return { blocked: false };

  const { data: profile } = await supabase
    .from('merchant_store_profiles')
    .select('id, user_id')
    .eq('document_tax_id', documentTaxId)
    .maybeSingle();

  if (profile?.id && profile.user_id !== userId) {
    return { blocked: true, reason: 'merchant_profile' };
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, owner_user_id')
    .eq('cnpj', documentTaxId)
    .maybeSingle();

  if (store?.id) {
    const ownerId = store.owner_user_id || null;
    if (ownerId && ownerId !== userId) {
      return { blocked: true, reason: 'store_cnpj' };
    }
    if (!ownerId && profile?.user_id !== userId) {
      // Loja órfã no mapa com mesmo documento — só bloqueia se não for deste user
      const { data: ownerProfile } = await supabase
        .from('merchant_store_profiles')
        .select('user_id')
        .eq('store_id', store.id)
        .maybeSingle();
      if (ownerProfile?.user_id && ownerProfile.user_id !== userId) {
        return { blocked: true, reason: 'store_cnpj' };
      }
    }
  }

  return { blocked: false };
}

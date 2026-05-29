import { syncMerchantStoreBindings } from '../merchant/syncMerchantStoreBindings';
import { evaluateDocumentTaxId } from './documentTaxIdPolicy';

/**
 * Cria store + merchant_store_profiles e vínculos para um user já existente.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function createPartnerStoreForUser(supabase, {
  userId,
  responsibleName,
  businessName,
  documentTaxId,
  address,
  addressComplement,
  lat,
  lng,
  confirmReusedDocumentTaxId = false,
}) {
  const docPolicy = await evaluateDocumentTaxId(supabase, {
    documentTaxId,
    userId,
    confirmReuse: Boolean(confirmReusedDocumentTaxId),
  });
  if (!docPolicy.allowed) {
    return {
      ok: false,
      status: 428,
      needsDocumentConfirmation: true,
      error: docPolicy.message,
    };
  }

  const { data: storeRow, error: storeErr } = await supabase
    .from('stores')
    .insert({
      name: businessName,
      type: 'restaurant',
      address: addressComplement ? `${address} — ${addressComplement}` : address,
      lat,
      lng,
      cnpj: documentTaxId,
      active: true,
      needs_review: true,
      owner_user_id: userId,
    })
    .select('id')
    .single();

  if (storeErr || !storeRow?.id) {
    console.error('[createPartnerStoreForUser] store:', storeErr);
    return { ok: false, status: 500, error: 'Erro ao registrar loja no mapa.' };
  }

  const { error: profileErr } = await supabase.from('merchant_store_profiles').insert({
    user_id: userId,
    store_id: storeRow.id,
    responsible_name: responsibleName,
    business_name: businessName,
    document_tax_id: documentTaxId,
    onboarding_status: 'pending_review',
    pickup_enabled: true,
  });

  if (profileErr) {
    console.error('[createPartnerStoreForUser] profile:', profileErr);
    await supabase.from('stores').delete().eq('id', storeRow.id);
    return { ok: false, status: 500, error: 'Erro ao finalizar cadastro da loja.' };
  }

  const nowIso = new Date().toISOString();
  const userPatch = {
    name: responsibleName,
    store_id: storeRow.id,
    account_type_selected_at: nowIso,
  };
  let { error: userUpdErr } = await supabase.from('users').update(userPatch).eq('id', userId);
  if (userUpdErr?.message?.includes('account_type_chosen_explicitly')) {
    const { account_type_selected_at: _drop2, ...legacy } = userPatch;
    ({ error: userUpdErr } = await supabase.from('users').update(legacy).eq('id', userId));
  }
  if (userUpdErr) {
    console.warn('[createPartnerStoreForUser] users update:', userUpdErr.message);
  }

  await syncMerchantStoreBindings(supabase, userId, storeRow.id);

  return { ok: true, storeId: storeRow.id };
}

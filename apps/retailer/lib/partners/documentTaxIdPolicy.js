/**
 * Política de CPF/CNPJ no cadastro parceiro:
 * - Mesmo documento em várias lojas é permitido (franquia / filiais).
 * - Se o documento já existe na plataforma e não é de uma loja deste usuário,
 *   exige confirmação única (confirmReusedDocumentTaxId) por usuário+documento.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} documentTaxId — só dígitos
 * @param {string|null|undefined} userId
 * @returns {Promise<boolean>}
 */
async function userOwnsDocumentTaxId(supabase, documentTaxId, userId) {
  if (!documentTaxId || !userId) return false;

  const { data: ownProfiles } = await supabase
    .from('merchant_store_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('document_tax_id', documentTaxId)
    .limit(1);

  if (Array.isArray(ownProfiles) && ownProfiles.length > 0) return true;

  const { data: ownStores } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('cnpj', documentTaxId)
    .limit(1);

  return Array.isArray(ownStores) && ownStores.length > 0;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} documentTaxId
 * @param {string|null|undefined} userId
 */
async function documentUsedOutsideUser(supabase, documentTaxId, userId) {
  if (!documentTaxId) return false;

  let profileQuery = supabase
    .from('merchant_store_profiles')
    .select('id, user_id')
    .eq('document_tax_id', documentTaxId)
    .limit(1);

  if (userId) profileQuery = profileQuery.neq('user_id', userId);

  const { data: otherProfile } = await profileQuery.maybeSingle();
  if (otherProfile?.id) return true;

  let storeQuery = supabase.from('stores').select('id, owner_user_id').eq('cnpj', documentTaxId).limit(1);

  const { data: store } = await storeQuery.maybeSingle();
  if (!store?.id) return false;

  if (userId && store.owner_user_id === userId) return false;

  if (store.owner_user_id && userId && store.owner_user_id !== userId) return true;
  if (store.owner_user_id && !userId) return true;

  if (!store.owner_user_id) {
    const { data: ownerProfile } = await supabase
      .from('merchant_store_profiles')
      .select('user_id')
      .eq('store_id', store.id)
      .maybeSingle();
    if (!ownerProfile?.user_id) return true;
    if (userId && ownerProfile.user_id === userId) return false;
    if (ownerProfile.user_id && ownerProfile.user_id !== userId) return true;
  }

  return false;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} documentTaxId
 */
export async function hasDocumentReuseAck(supabase, userId, documentTaxId) {
  if (!userId || !documentTaxId) return false;
  const { data } = await supabase
    .from('merchant_document_reuse_acknowledgments')
    .select('user_id')
    .eq('user_id', userId)
    .eq('document_digits', documentTaxId)
    .maybeSingle();
  return Boolean(data?.user_id);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} documentTaxId
 */
export async function saveDocumentReuseAck(supabase, userId, documentTaxId) {
  if (!userId || !documentTaxId) return;
  const { error } = await supabase.from('merchant_document_reuse_acknowledgments').upsert(
    {
      user_id: userId,
      document_digits: documentTaxId,
      acknowledged_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,document_digits' }
  );
  if (error) console.warn('[documentTaxIdPolicy] save ack:', error.message);
}

const CONFIRM_MESSAGE =
  'Este CPF/CNPJ já está cadastrado no FinMemory. Confirme que você está autorizado a usá-lo nesta loja (filial, franquia ou mesmo grupo).';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ documentTaxId: string, userId?: string|null, confirmReuse?: boolean }} opts
 * @returns {Promise<{ allowed: boolean, needsConfirmation?: boolean, message?: string, saveAckAfterUserId?: boolean }>}
 */
export async function evaluateDocumentTaxId(supabase, { documentTaxId, userId = null, confirmReuse = false }) {
  if (!documentTaxId) return { allowed: true };

  if (userId && (await userOwnsDocumentTaxId(supabase, documentTaxId, userId))) {
    return { allowed: true };
  }

  const usedElsewhere = await documentUsedOutsideUser(supabase, documentTaxId, userId || null);
  if (!usedElsewhere) return { allowed: true };

  if (userId && (await hasDocumentReuseAck(supabase, userId, documentTaxId))) {
    return { allowed: true };
  }

  if (confirmReuse) {
    if (userId) await saveDocumentReuseAck(supabase, userId, documentTaxId);
    return { allowed: true, saveAckAfterUserId: !userId };
  }

  return {
    allowed: false,
    needsConfirmation: true,
    message: CONFIRM_MESSAGE,
  };
}

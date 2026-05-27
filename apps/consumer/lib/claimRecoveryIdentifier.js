import { verifyPassword } from './passwordAuth';
import { normalizeEmail } from './securityPolicy';

/**
 * Confirma que email+senha pertencem à conta que já possui o telefone/CPF.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function verifyOwnerCredentials(supabase, ownerUserId, email, password) {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) {
    return { ok: false, error: 'Informe email e senha da conta que já usa este dado.' };
  }

  const { data: auth, error } = await supabase
    .from('auth_local_users')
    .select('user_id, password_hash')
    .eq('email', normalized)
    .maybeSingle();

  if (error || !auth?.password_hash) {
    return { ok: false, error: 'Email ou senha incorretos.' };
  }

  if (auth.user_id !== ownerUserId) {
    return {
      ok: false,
      error: 'Este email não é da conta que já usa este telefone ou CPF.',
    };
  }

  if (!verifyPassword(String(password), auth.password_hash)) {
    return { ok: false, error: 'Email ou senha incorretos.' };
  }

  return { ok: true };
}

/**
 * Localiza outra conta (não a atual) que já usa o telefone ou CPF.
 */
export async function findRecoveryIdentifierConflict(supabase, currentUserId, phoneDig, cpfDig) {
  /** @type {{ field: 'phone' | 'document', ownerId: string } | null} */
  let conflict = null;

  if (phoneDig) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('recovery_phone_digits', phoneDig)
      .neq('id', currentUserId)
      .maybeSingle();
    if (data?.id) conflict = { field: 'phone', ownerId: data.id };
  }

  if (!conflict && cpfDig) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('recovery_document_digits', cpfDig)
      .neq('id', currentUserId)
      .maybeSingle();
    if (data?.id) conflict = { field: 'document', ownerId: data.id };
  }

  return conflict;
}

/**
 * Remove telefone/CPF da conta antiga antes de gravar na conta atual.
 */
export async function releaseRecoveryIdentifiersFromUser(supabase, ownerUserId, { clearPhone, clearDocument }) {
  const patch = {};
  if (clearPhone) patch.recovery_phone_digits = null;
  if (clearDocument) patch.recovery_document_digits = null;
  if (!Object.keys(patch).length) return;
  await supabase.from('users').update(patch).eq('id', ownerUserId);
}

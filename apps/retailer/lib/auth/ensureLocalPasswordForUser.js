import { hashPassword } from '../passwordAuth';
import { generateInitialPassword } from './generateInitialPassword';
import { sendPartnerAccessCredentialsEmail } from './sendPartnerAccessEmail';

/**
 * Garante linha em auth_local_users com senha (nova ou fornecida) e envia e-mail de acesso.
 * @returns {{ password: string, emailed: boolean }}
 */
export async function ensureLocalPasswordForUser(supabase, {
  userId,
  email,
  name,
  password: providedPassword,
  storeName,
  forceNewPassword = false,
  sendEmail = true,
}) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!supabase || !userId || !normalized) {
    return { password: '', emailed: false };
  }

  const { data: existing } = await supabase
    .from('auth_local_users')
    .select('email, password_hash')
    .eq('email', normalized)
    .maybeSingle();

  const password =
    providedPassword ||
    (forceNewPassword || !existing?.password_hash ? generateInitialPassword() : null);

  if (!password) {
    return { password: '', emailed: false };
  }

  const nowIso = new Date().toISOString();
  const passwordHash = hashPassword(password);
  const row = {
    email: normalized,
    user_id: userId,
    password_hash: passwordHash,
    email_verified_at: nowIso,
    email_verify_token_hash: null,
    email_verify_expires_at: null,
    email_verify_token_hashes: [],
    updated_at: nowIso,
  };

  const { error } = await supabase.from('auth_local_users').upsert(row, { onConflict: 'email' });
  if (error) {
    console.error('[ensureLocalPasswordForUser]', error.message);
    return { password: '', emailed: false };
  }

  let emailed = false;
  if (sendEmail) {
    emailed = Boolean(
      await sendPartnerAccessCredentialsEmail({
        to: normalized,
        name,
        password,
        storeName,
      })
    );
  }

  return { password, emailed };
}

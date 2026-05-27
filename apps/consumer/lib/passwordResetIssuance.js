import { generateOpaqueToken } from './tokens';
import { sendSecurityEmail } from './securityEmail';

/**
 * Gera token de reset, grava auth_local_users e envia email.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export async function issuePasswordResetForNormalizedEmail(supabase, normalizedEmail) {
  if (!supabase || !normalizedEmail) return { ok: false, reason: 'missing' };

  const { data: authRow } = await supabase
    .from('auth_local_users')
    .select('email')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (!authRow) {
    console.info('[auth][password_reset] no_local_auth_row (generico)');
    return { ok: true };
  }

  const token = generateOpaqueToken();
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const { error: updErr } = await supabase
    .from('auth_local_users')
    .update({
      password_reset_token_hash: token.hash,
      password_reset_expires_at: expires,
      password_reset_used_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('email', normalizedEmail);
  if (updErr) {
    console.error('[auth][password_reset] update error:', updErr.message);
    return { ok: true };
  }

  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || 'https://finmemory.com.br';
  const resetUrl = `${appUrl}/login?resetToken=${token.raw}&email=${encodeURIComponent(normalizedEmail)}`;
  await sendSecurityEmail({
    to: normalizedEmail,
    subject: 'Redefinição de senha - FinMemory',
    html: `<p>Use este link para redefinir sua senha:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Link valido por 30 minutos.</p>`,
    fallbackLog: `password_reset_link=${resetUrl}`,
  });

  return { ok: true };
}

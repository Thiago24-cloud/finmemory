import { hashPassword } from '../../lib/passwordAuth';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { checkRateLimit, getRequestIp } from '../../lib/rateLimit';
import { generateOpaqueToken } from '../../lib/tokens';
import { sendSecurityEmail } from '../../lib/securityEmail';
import { isValidEmail, normalizeEmail, validatePasswordStrength } from '../../lib/securityPolicy';
import { mergeVerifyTokenHashes } from '../../lib/emailVerifyTokens';

/**
 * POST /api/signup
 * Body: { email: string, password: string, name?: string }
 * Cria conta local (email/senha) no FinMemory.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getRequestIp(req);
  const ipRate = checkRateLimit({ bucket: 'signup-ip', key: ip, limit: 8, windowMs: 15 * 60 * 1000 });
  if (!ipRate.allowed) {
    return res.status(429).json({ error: 'Muitas tentativas de cadastro. Tente mais tarde.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração indisponível' });
  }

  const { email, password, name } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido' });
  }
  const pwdCheck = validatePasswordStrength(password);
  if (!pwdCheck.ok) {
    return res.status(400).json({ error: pwdCheck.message });
  }

  const normalized = normalizeEmail(email);
  const emailRate = checkRateLimit({ bucket: 'signup-email', key: normalized, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!emailRate.allowed) {
    return res.status(429).json({ error: 'Muitas tentativas para esse email. Tente mais tarde.' });
  }
  const safeName = String(name || normalized.split('@')[0] || 'Usuário').slice(0, 120);
  const passwordHash = hashPassword(password);
  const verifyToken = generateOpaqueToken();
  const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .upsert(
        {
          email: normalized,
          name: safeName,
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

    if (userErr || !userRow?.id) {
      console.error('Signup users upsert:', userErr);
      return res.status(500).json({ error: userErr?.message || 'Erro ao criar utilizador' });
    }

    const { error: authErr } = await supabase
      .from('auth_local_users')
      .upsert(
        {
          email: normalized,
          user_id: userRow.id,
          password_hash: passwordHash,
          email_verified_at: null,
          email_verify_token_hash: verifyToken.hash,
          email_verify_token_hashes: mergeVerifyTokenHashes(null, verifyToken.hash),
          email_verify_expires_at: verifyExpiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );
    if (authErr) {
      console.error('Signup auth_local_users upsert:', authErr);
      return res.status(500).json({ error: authErr.message || 'Erro ao guardar senha' });
    }

    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || 'https://finmemory.com.br';
    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${verifyToken.raw}&email=${encodeURIComponent(normalized)}`;
    await sendSecurityEmail({
      to: normalized,
      subject: 'Confirme seu email no FinMemory',
      html: `<p>Confirme seu email para liberar o acesso ao app:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>Link valido por 24h.</p>`,
      fallbackLog: `verification_link=${verifyUrl}`,
    });

    console.info('[auth][signup]', { email: normalized, ip });
    return res.status(201).json({
      success: true,
      message: 'Conta criada. Verifique seu email para liberar o acesso.',
    });
  } catch (e) {
    console.error('Signup exception:', e);
    return res.status(500).json({ error: 'Erro ao cadastrar' });
  }
}

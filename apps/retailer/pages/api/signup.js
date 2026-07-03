import { hashPassword } from '../../lib/passwordAuth';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { checkRateLimit, getRequestIp } from '../../lib/rateLimit';
import { sendSecurityEmail } from '../../lib/securityEmail';
import { isValidEmail, normalizeEmail, validatePasswordStrength } from '../../lib/securityPolicy';
import { getPrivateBetaAllowlistFromEnv, isEmailAllowedInPrivateBeta } from '../../lib/privateBetaAllowlist';

/**
 * POST /api/signup
 * Cadastro normal do app Parceiros: cria apenas a conta do usuário.
 * Dados de loja/documento/endereço ficam para configuração posterior no painel.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getRequestIp(req);
  const ipRate = checkRateLimit({ bucket: 'retailer-signup-ip', key: ip, limit: 8, windowMs: 15 * 60 * 1000 });
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
  const allowlist = getPrivateBetaAllowlistFromEnv();
  if (!isEmailAllowedInPrivateBeta(normalized, allowlist)) {
    return res.status(403).json({ error: 'Cadastro não disponível neste momento.' });
  }

  const emailRate = checkRateLimit({
    bucket: 'retailer-signup-email',
    key: normalized,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!emailRate.allowed) {
    return res.status(429).json({ error: 'Muitas tentativas para esse email. Tente mais tarde.' });
  }

  const safeName = String(name || normalized.split('@')[0] || 'Usuário').slice(0, 120);
  const passwordHash = hashPassword(password);
  const nowIso = new Date().toISOString();

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
      console.error('[retailer signup] users upsert:', userErr);
      return res.status(500).json({ error: userErr?.message || 'Erro ao criar utilizador' });
    }

    const { error: authErr } = await supabase
      .from('auth_local_users')
      .upsert(
        {
          email: normalized,
          user_id: userRow.id,
          password_hash: passwordHash,
          email_verified_at: nowIso,
          email_verify_token_hash: null,
          email_verify_expires_at: null,
          email_verify_token_hashes: [],
          updated_at: nowIso,
        },
        { onConflict: 'email' }
      );

    if (authErr) {
      console.error('[retailer signup] auth_local_users upsert:', authErr);
      return res.status(500).json({ error: authErr.message || 'Erro ao guardar senha' });
    }

    const appUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_RETAILER_APP_URL ||
      'https://parceiros.finmemory.com.br';
    await sendSecurityEmail({
      to: normalized,
      subject: 'Bem-vindo ao FinMemory Parceiros',
      html: `<p>Sua conta está pronta.</p><p>Você já pode entrar no painel: <a href="${appUrl}/login">${appUrl}/login</a></p>`,
      fallbackLog: `retailer_welcome_signup=${normalized}`,
    });

    console.info('[retailer signup]', { email: normalized, ip });
    return res.status(201).json({
      success: true,
      userId: userRow.id,
      message: 'Conta criada.',
    });
  } catch (e) {
    console.error('[retailer signup] exception:', e);
    return res.status(500).json({ error: 'Erro ao cadastrar' });
  }
}

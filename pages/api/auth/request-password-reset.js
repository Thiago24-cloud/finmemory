import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { generateOpaqueToken } from '../../../lib/tokens';
import { normalizeEmail } from '../../../lib/securityPolicy';
import { checkRateLimit, getRequestIp } from '../../../lib/rateLimit';
import { sendSecurityEmail } from '../../../lib/securityEmail';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Configuração indisponível' });

  const ip = getRequestIp(req);
  const ipRate = checkRateLimit({ bucket: 'reset-ip', key: ip, limit: 12, windowMs: 60 * 60 * 1000 });
  if (!ipRate.allowed) return res.status(429).json({ error: 'Muitas tentativas.' });

  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(200).json({ ok: true });

  const { data: authRow, error: lookupErr } = await supabase
    .from('auth_local_users')
    .select('email')
    .eq('email', email)
    .maybeSingle();
  if (lookupErr) {
    console.error('[auth][password_reset] lookup error:', lookupErr.message);
    return res.status(200).json({ ok: true });
  }
  if (!authRow) {
    console.info('[auth][password_reset] no_local_auth_row (resposta generica ao cliente)');
    return res.status(200).json({ ok: true });
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
    .eq('email', email);
  if (updErr) {
    console.error('[auth][password_reset] update error:', updErr.message);
    return res.status(200).json({ ok: true });
  }

  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || 'https://finmemory.com.br';
  const resetUrl = `${appUrl}/login?resetToken=${token.raw}&email=${encodeURIComponent(email)}`;
  await sendSecurityEmail({
    to: email,
    subject: 'Redefinição de senha - FinMemory',
    html: `<p>Use este link para redefinir sua senha:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Link valido por 30 minutos.</p>`,
    fallbackLog: `password_reset_link=${resetUrl}`,
  });

  return res.status(200).json({ ok: true });
}

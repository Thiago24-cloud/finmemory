import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { generateOpaqueToken } from '../../../lib/tokens';
import { normalizeEmail } from '../../../lib/securityPolicy';
import { checkRateLimit, getRequestIp } from '../../../lib/rateLimit';
import { sendSecurityEmail } from '../../../lib/securityEmail';
import { mergeVerifyTokenHashes } from '../../../lib/emailVerifyTokens';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Configuração indisponível' });

  const ip = getRequestIp(req);
  const ipRate = checkRateLimit({ bucket: 'resend-ip', key: ip, limit: 15, windowMs: 60 * 60 * 1000 });
  if (!ipRate.allowed) return res.status(429).json({ error: 'Muitas tentativas.' });

  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(200).json({ ok: true });

  const { data: row } = await supabase
    .from('auth_local_users')
    .select('email_verified_at,email_verify_token_hash,email_verify_token_hashes')
    .eq('email', email)
    .maybeSingle();

  if (row?.email_verified_at) {
    return res.status(200).json({ ok: true });
  }

  const token = generateOpaqueToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const merged = mergeVerifyTokenHashes(row?.email_verify_token_hashes, token.hash);

  await supabase
    .from('auth_local_users')
    .update({
      email_verify_token_hash: token.hash,
      email_verify_token_hashes: merged,
      email_verify_expires_at: expires,
      updated_at: new Date().toISOString(),
    })
    .eq('email', email)
    .is('email_verified_at', null);

  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || 'https://finmemory.com.br';
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token.raw}&email=${encodeURIComponent(email)}`;
  await sendSecurityEmail({
    to: email,
    subject: 'Novo link de confirmação - FinMemory',
    html: `<p>Use este link para confirmar seu email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>Link valido por 24h.</p>`,
    fallbackLog: `verification_link=${verifyUrl}`,
  });

  return res.status(200).json({ ok: true });
}

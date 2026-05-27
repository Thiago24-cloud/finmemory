import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { hashToken } from '../../../lib/tokens';
import { hashPassword } from '../../../lib/passwordAuth';
import { validatePasswordStrength, normalizeEmail } from '../../../lib/securityPolicy';
import { checkRateLimit, getRequestIp } from '../../../lib/rateLimit';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Configuração indisponível' });

  const ip = getRequestIp(req);
  const ipRate = checkRateLimit({ bucket: 'reset-confirm-ip', key: ip, limit: 20, windowMs: 60 * 60 * 1000 });
  if (!ipRate.allowed) return res.status(429).json({ error: 'Muitas tentativas.' });

  const email = normalizeEmail(req.body?.email);
  const token = String(req.body?.token || '');
  const newPassword = String(req.body?.password || '');
  const check = validatePasswordStrength(newPassword);
  if (!email || !token) return res.status(400).json({ error: 'Dados inválidos.' });
  if (!check.ok) return res.status(400).json({ error: check.message });

  const tokenHash = hashToken(token);
  const nowIso = new Date().toISOString();
  const { data: row, error } = await supabase
    .from('auth_local_users')
    .select('password_reset_token_hash,password_reset_expires_at,password_reset_used_at')
    .eq('email', email)
    .maybeSingle();

  if (error || !row) return res.status(400).json({ error: 'Token inválido.' });
  if (row.password_reset_used_at) return res.status(400).json({ error: 'Token já utilizado.' });
  if (!row.password_reset_expires_at || row.password_reset_expires_at < nowIso) {
    return res.status(400).json({ error: 'Token expirado.' });
  }
  if (row.password_reset_token_hash !== tokenHash) return res.status(400).json({ error: 'Token inválido.' });

  const { error: updErr } = await supabase
    .from('auth_local_users')
    .update({
      password_hash: hashPassword(newPassword),
      password_reset_used_at: nowIso,
      password_reset_token_hash: null,
      password_reset_expires_at: null,
      failed_login_attempts: 0,
      lockout_until: null,
      updated_at: nowIso,
    })
    .eq('email', email);
  if (updErr) return res.status(500).json({ error: 'Falha ao redefinir senha.' });
  return res.status(200).json({ ok: true });
}

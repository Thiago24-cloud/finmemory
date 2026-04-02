import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { hashToken } from '../../../lib/tokens';
import { normalizeEmail } from '../../../lib/securityPolicy';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Configuração indisponível' });

  const token = String(req.query?.token || '');
  const email = normalizeEmail(req.query?.email);
  if (!token || !email) return res.status(400).json({ error: 'Link inválido.' });

  const tokenHash = hashToken(token);
  const nowIso = new Date().toISOString();

  const { data: row, error } = await supabase
    .from('auth_local_users')
    .select('email_verify_token_hash,email_verify_token_hashes,email_verify_expires_at,email_verified_at')
    .eq('email', email)
    .maybeSingle();

  if (error || !row) return res.status(400).json({ error: 'Link inválido.' });
  if (row.email_verified_at) return res.redirect(302, '/login?verified=1');
  if (!row.email_verify_expires_at || row.email_verify_expires_at < nowIso) {
    return res.status(400).json({ error: 'Link expirado. Solicite novo envio.' });
  }
  const hashes = Array.isArray(row.email_verify_token_hashes) ? row.email_verify_token_hashes : [];
  const tokenOk =
    row.email_verify_token_hash === tokenHash || hashes.includes(tokenHash);
  if (!tokenOk) return res.status(400).json({ error: 'Link inválido.' });

  const { error: updErr } = await supabase
    .from('auth_local_users')
    .update({
      email_verified_at: nowIso,
      email_verify_token_hash: null,
      email_verify_token_hashes: null,
      email_verify_expires_at: null,
      updated_at: nowIso,
    })
    .eq('email', email);
  if (updErr) return res.status(500).json({ error: 'Não foi possível confirmar.' });
  return res.redirect(302, '/login?verified=1');
}

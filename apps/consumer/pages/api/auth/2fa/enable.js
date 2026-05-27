import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyTotpCode } from '../../../../lib/tokens';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  const email = String(session?.user?.email || '').toLowerCase();
  if (!email) return res.status(401).json({ error: 'Não autenticado' });

  const code = String(req.body?.code || '').trim();
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Configuração indisponível' });

  const { data: row, error } = await supabase
    .from('auth_local_users')
    .select('totp_secret')
    .eq('email', email)
    .maybeSingle();
  if (error || !row?.totp_secret) return res.status(400).json({ error: '2FA não iniciado' });

  const valid = verifyTotpCode({ secret: row.totp_secret, code, window: 1 });
  if (!valid) return res.status(400).json({ error: 'Código inválido' });

  await supabase
    .from('auth_local_users')
    .update({
      totp_enabled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('email', email);

  return res.status(200).json({ ok: true });
}

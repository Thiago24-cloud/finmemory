import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { generateTotpSecret, getOtpAuthUrl } from '../../../../lib/tokens';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  const email = String(session?.user?.email || '').toLowerCase();
  if (!email) return res.status(401).json({ error: 'Não autenticado' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Configuração indisponível' });

  const secret = generateTotpSecret();
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('auth_local_users')
    .update({
      totp_secret: secret,
      totp_enabled_at: null,
      updated_at: nowIso,
    })
    .eq('email', email);
  if (error) return res.status(500).json({ error: 'Falha ao iniciar 2FA' });

  const issuer = process.env.AUTH_TOTP_ISSUER || 'FinMemory';
  const otpauthUrl = getOtpAuthUrl({ issuer, accountName: email, secret });
  return res.status(200).json({ secret, otpauthUrl });
}

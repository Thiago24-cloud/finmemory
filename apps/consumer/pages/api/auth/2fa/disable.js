import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  const email = String(session?.user?.email || '').toLowerCase();
  if (!email) return res.status(401).json({ error: 'Não autenticado' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Configuração indisponível' });
  await supabase
    .from('auth_local_users')
    .update({
      totp_secret: null,
      totp_enabled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('email', email);

  return res.status(200).json({ ok: true });
}

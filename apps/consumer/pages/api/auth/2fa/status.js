import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  const email = String(session?.user?.email || '').toLowerCase();
  if (!email) return res.status(401).json({ error: 'Não autenticado' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Configuração indisponível' });
  const { data } = await supabase
    .from('auth_local_users')
    .select('totp_enabled_at')
    .eq('email', email)
    .maybeSingle();
  return res.status(200).json({ enabled: Boolean(data?.totp_enabled_at) });
}

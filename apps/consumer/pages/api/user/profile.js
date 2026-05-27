/**
 * PATCH /api/user/profile — atualiza nome de exibição (public.users.name).
 * Body: { name: string }
 */
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!session?.user?.email || !userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Serviço indisponível' });
  }

  const name = String(req.body?.name ?? req.body?.displayName ?? '').trim();
  if (name.length < 1 || name.length > 120) {
    return res.status(400).json({ error: 'Informe um nome entre 1 e 120 caracteres.' });
  }

  const { data, error } = await supabase
    .from('users')
    .update({ name })
    .eq('id', userId)
    .select('name, avatar_url')
    .maybeSingle();

  if (error) {
    console.error('[user/profile PATCH]', error.message);
    return res.status(500).json({ error: 'Não foi possível salvar o nome.' });
  }

  return res.status(200).json({
    ok: true,
    name: data?.name || name,
    avatarUrl: data?.avatar_url || null,
  });
}

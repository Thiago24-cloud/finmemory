import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

let supabaseInstance = null;

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

/**
 * GET /api/map/gamification-me
 * XP / nível do utilizador (public.users.id = session.user.supabaseId).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!session?.user?.email || !userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const { data, error } = await supabase
    .from('users')
    .select('xp_points, contributions_count, level')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (/column|does not exist/i.test(error.message || '')) {
      return res.status(200).json({ xp_points: 0, contributions_count: 0, level: 1 });
    }
    console.warn('gamification-me:', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    xp_points: Number(data?.xp_points) || 0,
    contributions_count: Number(data?.contributions_count) || 0,
    level: Number(data?.level) || 1,
  });
}

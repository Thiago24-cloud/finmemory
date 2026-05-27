import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { bumpStreakFromActivity } from '../../../lib/gamification/streakEngine';

/**
 * GET  /api/gamification/streak → { streak_current, streak_max }
 * POST /api/gamification/streak → incrementa streak se a última ação foi ontem ou nunca
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!session?.user?.email || !userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('users')
      .select('streak_current, streak_max')
      .eq('id', userId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({
      streak_current: Number(data?.streak_current) || 0,
      streak_max: Number(data?.streak_max) || 0,
    });
  }

  try {
    const result = await bumpStreakFromActivity(supabase, userId);
    return res.status(200).json({
      streak_current: result.streak_current,
      streak_max: result.streak_max,
      updated: result.updated,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Erro ao atualizar streak' });
  }
}

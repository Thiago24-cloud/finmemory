import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

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

  // POST: incrementa streak
  const { data: user, error: fetchErr } = await supabase
    .from('users')
    .select('streak_current, streak_max, streak_last_action_date')
    .eq('id', userId)
    .maybeSingle();

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });

  const todayBR = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  ).toISOString().slice(0, 10);

  const lastDate = user?.streak_last_action_date || null;

  if (lastDate === todayBR) {
    // Já contou hoje — não incrementar
    return res.status(200).json({
      streak_current: user.streak_current,
      streak_max: user.streak_max,
      updated: false,
    });
  }

  const yesterdayBR = new Date(
    new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getTime() -
      86400000
  )
    .toISOString()
    .slice(0, 10);

  const isConsecutive = lastDate === yesterdayBR;
  const newStreak = isConsecutive ? (user?.streak_current || 0) + 1 : 1;
  const newMax = Math.max(newStreak, user?.streak_max || 0);

  const { error: updateErr } = await supabase
    .from('users')
    .update({
      streak_current: newStreak,
      streak_max: newMax,
      streak_last_action_date: todayBR,
    })
    .eq('id', userId);

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  return res.status(200).json({ streak_current: newStreak, streak_max: newMax, updated: true });
}

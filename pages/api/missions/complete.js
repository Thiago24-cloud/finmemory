import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { todayBR } from '../../../lib/gamification/spTimezone';

/**
 * POST /api/missions/complete
 * Body: { mission_id: string, steps?: number }
 * Incrementa steps_done na missão do dia. Se atingir total_steps, marca como concluída e adiciona XP.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!session?.user?.email || !userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { mission_id, steps = 1 } = req.body || {};
  if (!mission_id) return res.status(400).json({ error: 'mission_id obrigatório' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const today = todayBR();

  const { data: mission, error: mErr } = await supabase
    .from('daily_missions')
    .select('*')
    .eq('id', mission_id)
    .eq('active', true)
    .maybeSingle();

  if (mErr || !mission) return res.status(404).json({ error: 'Missão não encontrada' });

  // Upsert do completion
  const { data: existing } = await supabase
    .from('user_mission_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('mission_id', mission_id)
    .eq('mission_date', today)
    .maybeSingle();

  if (existing?.completed) {
    return res.status(200).json({ already_completed: true, xp_awarded: 0 });
  }

  const newSteps = Math.min((existing?.steps_done || 0) + steps, mission.total_steps);
  const nowComplete = newSteps >= mission.total_steps;

  const upsertPayload = {
    user_id: userId,
    mission_id,
    mission_date: today,
    steps_done: newSteps,
    completed: nowComplete,
    completed_at: nowComplete ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase
    .from('user_mission_completions')
    .upsert(upsertPayload, { onConflict: 'user_id,mission_id,mission_date' });

  if (upsertErr) return res.status(500).json({ error: upsertErr.message });

  let xpAwarded = 0;
  if (nowComplete) {
    const { data: streakUser } = await supabase
      .from('users')
      .select('welcome_back_bonus_until')
      .eq('id', userId)
      .maybeSingle();
    const doubleXp = streakUser?.welcome_back_bonus_until === today;
    xpAwarded = mission.xp_reward * (doubleXp ? 2 : 1);
    await supabase.rpc('award_mission_xp', { p_user_id: userId, p_xp: xpAwarded }).catch(() => {
      // Fallback se a RPC não existir: UPDATE direto
      return supabase.from('users').select('xp_points, level').eq('id', userId).maybeSingle().then(({ data }) => {
        const newXp = (data?.xp_points || 0) + xpAwarded;
        const newLevel = 1 + Math.floor(newXp / 100);
        return supabase.from('users').update({ xp_points: newXp, level: newLevel }).eq('id', userId);
      });
    });
  }

  return res.status(200).json({
    steps_done: newSteps,
    completed: nowComplete,
    xp_awarded: xpAwarded,
  });
}

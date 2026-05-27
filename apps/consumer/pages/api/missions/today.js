import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

/**
 * GET /api/missions/today
 * Retorna todas as missões ativas com o progresso do usuário para hoje (BR).
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

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const todayBR = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  ).toISOString().slice(0, 10);

  const { data: missions, error: mErr } = await supabase
    .from('daily_missions')
    .select('*')
    .eq('active', true)
    .order('sort_order');

  if (mErr) return res.status(500).json({ error: mErr.message });

  const { data: completions, error: cErr } = await supabase
    .from('user_mission_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('mission_date', todayBR);

  if (cErr) return res.status(500).json({ error: cErr.message });

  const completionMap = Object.fromEntries((completions || []).map((c) => [c.mission_id, c]));

  const result = (missions || []).map((m) => {
    const c = completionMap[m.id];
    return {
      ...m,
      steps_done: c?.steps_done || 0,
      completed: c?.completed || false,
      completed_at: c?.completed_at || null,
    };
  });

  // Calcular tempo até reset (próxima meia-noite horário BR)
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const midnightBR = new Date(nowBR);
  midnightBR.setHours(24, 0, 0, 0);
  const secondsUntilReset = Math.floor((midnightBR - nowBR) / 1000);

  return res.status(200).json({ missions: result, seconds_until_reset: secondsUntilReset, today: todayBR });
}

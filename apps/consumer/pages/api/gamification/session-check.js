import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { processLoginEngagement } from '../../../lib/gamification/streakEngine';

/**
 * POST /api/gamification/session-check
 * Roda ao abrir o app (sessão ativa): atualiza last_login_at, ofensiva, welcome back.
 * Body opcional: { dismiss_welcome_back: true }
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

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  try {
    const { dismiss_welcome_back: dismiss } = req.body || {};

    if (dismiss) {
      await supabase
        .from('users')
        .update({ welcome_back_last_shown_at: new Date().toISOString() })
        .eq('id', userId);
      return res.status(200).json({ success: true, dismissed: true });
    }

    const result = await processLoginEngagement(supabase, userId);

    const shouldShowModal =
      result.show_welcome_back &&
      !(await wasWelcomeBackShownRecently(supabase, userId));

    if (shouldShowModal) {
      await supabase
        .from('users')
        .update({ welcome_back_last_shown_at: new Date().toISOString() })
        .eq('id', userId);
    }

    return res.status(200).json({
      success: true,
      show_welcome_back: shouldShowModal,
      display_name: result.display_name,
      current_streak: result.current_streak,
      longest_streak: result.longest_streak,
      streak_freeze_count: result.streak_freeze_count,
      double_xp_today: result.double_xp_today,
      bonus_copy: result.bonus_copy,
      freeze_used: result.freeze_used,
      streak_reset: result.streak_reset,
      inactive_hours: result.inactive_hours,
    });
  } catch (e) {
    console.error('[session-check]', e);
    return res.status(500).json({
      success: false,
      error: e?.message || 'Erro ao processar sessão',
    });
  }
}

async function wasWelcomeBackShownRecently(supabase, userId) {
  const { data } = await supabase
    .from('users')
    .select('welcome_back_last_shown_at')
    .eq('id', userId)
    .maybeSingle();

  const shown = data?.welcome_back_last_shown_at;
  if (!shown) return false;
  const hours = (Date.now() - Date.parse(shown)) / 3600000;
  return hours < 12;
}

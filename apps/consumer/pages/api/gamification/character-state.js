import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { buildCharacterEngineResponse } from '../../../lib/gamification/resolveCharacterState';
import { todayBR } from '../../../lib/gamification/spTimezone';

/**
 * GET /api/gamification/character-state
 * Query: context=dashboard|map, expenseTotal, incomeTotal, hasAccounts, syncing, allMissionsComplete
 * POST body: mesmo snapshot (preferível — evita expor tudo na URL)
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

  const raw = req.method === 'POST' ? req.body || {} : req.query || {};

  const signals = {
    context: raw.context === 'map' ? 'map' : 'dashboard',
    loading: raw.loading === true || raw.loading === 'true',
    hasOpenFinanceAccounts:
      raw.hasOpenFinanceAccounts === true ||
      raw.hasOpenFinanceAccounts === 'true' ||
      Number(raw.accountCount) > 0,
    syncing: raw.syncing === true || raw.syncing === 'true',
    justSynced: raw.justSynced === true || raw.justSynced === 'true',
    expenseTotal: Number(raw.expenseTotal) || 0,
    incomeTotal: Number(raw.incomeTotal) || 0,
    allMissionsComplete:
      raw.allMissionsComplete === true || raw.allMissionsComplete === 'true',
    hasAnyMission: raw.hasAnyMission === true || raw.hasAnyMission === 'true',
    streakCurrent: Number(raw.streakCurrent) || 0,
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const [{ data: userRow }, { data: missions }] = await Promise.all([
        supabase
          .from('users')
          .select('streak_current, welcome_back_bonus_until')
          .eq('id', userId)
          .maybeSingle(),
        supabase.from('daily_missions').select('id').eq('active', true),
      ]);

      if (userRow?.streak_current != null) {
        signals.streakCurrent = Number(userRow.streak_current) || 0;
      }
      signals.welcomeBackToday = userRow?.welcome_back_bonus_until === todayBR();

      if (!signals.hasAnyMission && Array.isArray(missions)) {
        signals.hasAnyMission = missions.length > 0;
      }
    } catch (e) {
      console.warn('[character-state] enrich:', e?.message);
    }
  }

  const payload = buildCharacterEngineResponse(userId, signals);
  return res.status(200).json({ success: true, ...payload });
}

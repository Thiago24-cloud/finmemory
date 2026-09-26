/**
 * GET /api/account/app-home
 * Destino correto após login / reabrir o app.
 */
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { fetchUserPlanPreference, homePathFromPreference } from '../../../lib/planPreference';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) return res.status(401).json({ error: 'Faça login.', home: '/login' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível', home: '/inicio' });

  const prefs = await fetchUserPlanPreference(supabase, userId);
  const home = homePathFromPreference(prefs || {});

  return res.status(200).json({
    home,
    preferred_audience: prefs?.preferred_audience || null,
    preferred_plan: prefs?.preferred_plan || null,
    plan_trial_ends_at: prefs?.plan_trial_ends_at || null,
  });
}

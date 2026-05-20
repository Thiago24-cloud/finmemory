import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import {
  DEFAULT_ONBOARDING_PROGRESS,
  hasSeenDashboardOnboarding,
  isValidOnboardingKey,
  normalizeOnboardingProgress,
} from '../../../lib/onboarding/userOnboardingProgress';

async function resolveAppUserId(session, supabase) {
  let userId = session?.user?.supabaseId;
  if (userId) return userId;
  const email = session?.user?.email;
  if (!email || !supabase) return null;
  const { data, error } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (error || !data?.id) return null;
  return data.id;
}

function isMissingOnboardingSchema(error) {
  const m = String(error?.message || '').toLowerCase();
  return (
    m.includes('onboarding_progress') ||
    m.includes('update_user_onboarding_progress') ||
    (m.includes('column') && m.includes('does not exist')) ||
    m.includes('schema cache') ||
    m.includes('could not find the function')
  );
}

function resolvePostKey(body) {
  const key = body?.key;
  if (isValidOnboardingKey(key)) return key;
  if (body?.has_seen_onboarding === true) return 'home_intro';
  return 'home_intro';
}

function resolvePostValue(body) {
  if (typeof body?.value === 'boolean') return body.value;
  if (body?.has_seen_onboarding === true) return true;
  return true;
}

/**
 * GET  /api/user/onboarding
 *   → { showTour, has_seen_onboarding, onboarding_progress }
 * POST /api/user/onboarding
 *   body: { key?, value? } | { has_seen_onboarding: true }
 *   → RPC update_user_onboarding_progress (service_role)
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email && !session?.user?.supabaseId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  const userId = await resolveAppUserId(session, supabase);
  if (!userId) {
    return res.status(401).json({ error: 'Utilizador não encontrado' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('users')
      .select('onboarding_progress')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (isMissingOnboardingSchema(error)) {
        return res.status(200).json({
          showTour: true,
          has_seen_onboarding: false,
          onboarding_progress: { ...DEFAULT_ONBOARDING_PROGRESS },
          reason: 'column_missing',
        });
      }
      console.error('[onboarding GET]', error.message);
      return res.status(500).json({ error: error.message });
    }

    const progress = normalizeOnboardingProgress(data?.onboarding_progress);
    const seen = hasSeenDashboardOnboarding(progress);

    return res.status(200).json({
      showTour: !seen,
      has_seen_onboarding: seen,
      onboarding_progress: progress,
    });
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const key = resolvePostKey(body);
    const value = resolvePostValue(body);

    const { data, error } = await supabase.rpc('update_user_onboarding_progress', {
      p_user_id: userId,
      p_key: key,
      p_value: value,
    });

    if (error) {
      if (isMissingOnboardingSchema(error)) {
        return res.status(200).json({
          ok: true,
          saved: false,
          reason: 'schema_missing',
        });
      }
      console.error('[onboarding POST]', error.message);
      return res.status(500).json({ error: error.message });
    }

    const progress = normalizeOnboardingProgress(data);
    return res.status(200).json({
      ok: true,
      saved: true,
      key,
      onboarding_progress: progress,
      has_seen_onboarding: hasSeenDashboardOnboarding(progress),
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

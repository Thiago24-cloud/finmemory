import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { getConsumerCoachStep } from '../../../lib/onboarding/coachConsumerSteps';
import {
  applyCoachHintDismiss,
  applyIntroStepComplete,
  applyCacaPrecoMapJourneyComplete,
  isIntroSequenceComplete,
  normalizeCoachJourney,
  resolveCoachHint,
  DEFAULT_COACH_JOURNEY,
} from '../../../lib/onboarding/coachJourneyEngine';
import { hoursSinceIso } from '../../../lib/gamification/spTimezone';
import { normalizeOnboardingProgress } from '../../../lib/onboarding/userOnboardingProgress';
async function resolveAppUserId(session, supabase) {
  let userId = session?.user?.supabaseId;
  if (userId) return userId;
  const email = session?.user?.email;
  if (!email || !supabase) return null;
  const { data, error } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (error || !data?.id) return null;
  return data.id;
}

/**
 * GET  /api/user/coach-journey → próxima dica (intro ou reengajamento)
 * POST /api/user/coach-journey → complete_step | dismiss | record_feature
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email && !session?.user?.supabaseId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Configuração incompleta' });

  const userId = await resolveAppUserId(session, supabase);
  if (!userId) return res.status(401).json({ error: 'Utilizador não encontrado' });

  const { data: userRow, error: fetchErr } = await supabase
    .from('users')
    .select('coach_journey, onboarding_progress, last_login_at, account_type')
    .eq('id', userId)
    .maybeSingle();

  if (fetchErr) {
    const missing = String(fetchErr.message || '').includes('coach_journey');
    if (missing && req.method === 'GET') {
      return res.status(200).json({
        show: false,
        reason: 'coach_journey_column_missing',
      });
    }
    console.error('[coach-journey fetch]', fetchErr.message);
    return res.status(500).json({ error: fetchErr.message });
  }

  const journey = normalizeCoachJourney(userRow?.coach_journey);
  const progress = normalizeOnboardingProgress(userRow?.onboarding_progress);
  const inactiveHours = hoursSinceIso(userRow?.last_login_at);

  if (req.method === 'GET') {
    const resolved = resolveCoachHint({
      coachJourney: journey,
      onboardingProgress: progress,
      inactiveHours,
    });

    return res.status(200).json({
      ...resolved,
      coach_journey: journey,
      introComplete: isIntroSequenceComplete(journey),
      inactiveHours: Number.isFinite(inactiveHours) ? Math.round(inactiveHours) : null,
    });
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const action = body.action;

    if (action === 'record_feature' && typeof body.featureId === 'string') {
      const next = normalizeCoachJourney(journey);
      next.feature_last_used[body.featureId] = new Date().toISOString();
      await supabase.from('users').update({ coach_journey: next }).eq('id', userId);
      return res.status(200).json({ ok: true, coach_journey: next });
    }

    if (action === 'complete_caca_preco_map') {
      const nextJourney = applyCacaPrecoMapJourneyComplete(journey);
      await supabase.from('users').update({ coach_journey: nextJourney }).eq('id', userId);
      await supabase.rpc('update_user_onboarding_progress', {
        p_user_id: userId,
        p_key: 'map_opened',
        p_value: true,
      });
      return res.status(200).json({ ok: true, coach_journey: nextJourney });
    }

    const stepId = body.stepId;
    const step = typeof stepId === 'string' ? getConsumerCoachStep(stepId) : null;

    let nextJourney = journey;
    let markHomeIntro = false;

    if (action === 'complete_step' && step) {
      if (body.mode === 'intro') {
        nextJourney = applyIntroStepComplete(journey, step.id, step);
        if (isIntroSequenceComplete(nextJourney)) markHomeIntro = true;
      } else {
        nextJourney = applyIntroStepComplete(journey, step.id, step);
      }
    } else if (action === 'dismiss' && step) {
      nextJourney = applyCoachHintDismiss(journey, step);
      if (body.mode === 'intro') {
        nextJourney = applyIntroStepComplete(nextJourney, step.id, step);
        if (isIntroSequenceComplete(nextJourney)) markHomeIntro = true;
      }
    } else {
      return res.status(400).json({ error: 'action inválida' });
    }

    await supabase.from('users').update({ coach_journey: nextJourney }).eq('id', userId);

    if (markHomeIntro) {
      await supabase.rpc('update_user_onboarding_progress', {
        p_user_id: userId,
        p_key: 'home_intro',
        p_value: true,
      });
    }

    return res.status(200).json({
      ok: true,
      coach_journey: nextJourney,
      home_intro_complete: markHomeIntro,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

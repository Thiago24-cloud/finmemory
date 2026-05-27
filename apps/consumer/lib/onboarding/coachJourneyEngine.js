import {
  CONSUMER_COACH_PRIORITY,
  CONSUMER_INTRO_STEP_ORDER,
  getConsumerCoachStep,
} from './coachConsumerSteps';
import { hasSeenDashboardOnboarding, normalizeOnboardingProgress } from './userOnboardingProgress';

const MS_HOUR = 3600000;
const COACH_COOLDOWN_HOURS = 24;
const REENGAGE_APP_INACTIVE_HOURS = 48;
const FEATURE_STALE_DAYS = 7;

/**
 * @typedef {Object} CoachJourneyState
 * @property {string[]} intro_completed
 * @property {Record<string, string>} feature_last_used — ISO timestamps
 * @property {string | null} last_coach_shown_at
 * @property {Record<string, string>} hints_dismissed
 */

export const DEFAULT_COACH_JOURNEY = Object.freeze({
  intro_completed: [],
  feature_last_used: {},
  last_coach_shown_at: null,
  hints_dismissed: {},
});

/**
 * @param {unknown} raw
 * @returns {CoachJourneyState}
 */
export function normalizeCoachJourney(raw) {
  const base = {
    intro_completed: [],
    feature_last_used: {},
    last_coach_shown_at: null,
    hints_dismissed: {},
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (Array.isArray(o.intro_completed)) {
    base.intro_completed = o.intro_completed.filter((x) => typeof x === 'string');
  }
  if (o.feature_last_used && typeof o.feature_last_used === 'object' && !Array.isArray(o.feature_last_used)) {
    for (const [k, v] of Object.entries(o.feature_last_used)) {
      if (typeof v === 'string') base.feature_last_used[k] = v;
    }
  }
  if (typeof o.last_coach_shown_at === 'string') base.last_coach_shown_at = o.last_coach_shown_at;
  if (o.hints_dismissed && typeof o.hints_dismissed === 'object' && !Array.isArray(o.hints_dismissed)) {
    for (const [k, v] of Object.entries(o.hints_dismissed)) {
      if (typeof v === 'string') base.hints_dismissed[k] = v;
    }
  }
  return base;
}

/**
 * @param {CoachJourneyState} journey
 * @returns {boolean}
 */
export function isIntroSequenceComplete(journey) {
  return CONSUMER_INTRO_STEP_ORDER.every((id) => journey.intro_completed.includes(id));
}

/**
 * @param {CoachJourneyState} journey
 * @returns {import('./coachConsumerSteps').CoachStep | null}
 */
export function pickNextIntroStep(journey) {
  const nextId = CONSUMER_INTRO_STEP_ORDER.find((id) => !journey.intro_completed.includes(id));
  return nextId ? getConsumerCoachStep(nextId) : null;
}

/**
 * @param {string | null | undefined} iso
 * @returns {number}
 */
function hoursSince(iso) {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / MS_HOUR;
}

/**
 * @param {string | null | undefined} iso
 * @returns {number}
 */
function daysSince(iso) {
  return hoursSince(iso) / 24;
}

/**
 * @param {CoachJourneyState} journey
 * @param {number} inactiveHours — horas desde last_login_at (antes desta sessão)
 * @returns {import('./coachConsumerSteps').CoachStep | null}
 */
export function pickReengagementCoachStep(journey, inactiveHours) {
  if (inactiveHours < REENGAGE_APP_INACTIVE_HOURS) return null;
  if (hoursSince(journey.last_coach_shown_at) < COACH_COOLDOWN_HOURS) return null;

  const candidates = CONSUMER_COACH_PRIORITY.map((featureId) => {
    const lastUsed = journey.feature_last_used[featureId];
    const dismissedAt = journey.hints_dismissed[featureId];
    if (dismissedAt && hoursSince(dismissedAt) < COACH_COOLDOWN_HOURS * 2) {
      return null;
    }
    const staleDays = lastUsed ? daysSince(lastUsed) : 999;
    if (staleDays < FEATURE_STALE_DAYS) return null;

    const stepId =
      featureId === 'mapa' ? 'caca-preco' : featureId === 'scan' ? 'escanear' : featureId;
    const step = getConsumerCoachStep(stepId);
    if (!step) return null;
    return { step, staleDays, featureId };
  }).filter(Boolean);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.staleDays - a.staleDays);
  return candidates[0].step;
}

/**
 * Decide qual dica mostrar agora (consumidor).
 *
 * @param {{
 *   coachJourney: CoachJourneyState,
 *   onboardingProgress: Record<string, boolean>,
 *   inactiveHours: number,
 * }} input
 * @returns {{ show: boolean, mode: 'intro' | 'coach' | null, step: import('./coachConsumerSteps').CoachStep | null, reason: string }}
 */
export function resolveCoachHint(input) {
  const { coachJourney, onboardingProgress, inactiveHours } = input;

  const journey = normalizeCoachJourney(coachJourney);
  const progress = normalizeOnboardingProgress(onboardingProgress);

  if (!isIntroSequenceComplete(journey)) {
    const step = pickNextIntroStep(journey);
    if (step) {
      return { show: true, mode: 'intro', step, reason: 'intro_next_step' };
    }
  }

  if (!progress.home_intro && isIntroSequenceComplete(journey)) {
    /* intro acabou nesta sessão — home_intro será gravado no complete */
  }

  const coachStep = pickReengagementCoachStep(journey, inactiveHours);
  if (coachStep) {
    return { show: true, mode: 'coach', step: coachStep, reason: 'feature_reengage' };
  }

  if (!progress.home_intro && hasSeenDashboardOnboarding(progress)) {
    return { show: false, mode: null, step: null, reason: 'legacy_done' };
  }

  return { show: false, mode: null, step: null, reason: 'no_hint' };
}

/**
 * @param {CoachJourneyState} journey
 * @param {string} stepId
 * @param {import('./coachConsumerSteps').CoachStep | null} step
 * @returns {CoachJourneyState}
 */
export function applyIntroStepComplete(journey, stepId, step) {
  const next = normalizeCoachJourney(journey);
  if (!next.intro_completed.includes(stepId)) {
    next.intro_completed = [...next.intro_completed, stepId];
  }
  if (step?.featureId) {
    next.feature_last_used[step.featureId] = new Date().toISOString();
  }
  next.last_coach_shown_at = new Date().toISOString();
  return next;
}

/**
 * @param {CoachJourneyState} journey
 * @param {import('./coachConsumerSteps').CoachStep} step
 * @returns {CoachJourneyState}
 */
export function applyCoachHintDismiss(journey, step) {
  const next = normalizeCoachJourney(journey);
  next.last_coach_shown_at = new Date().toISOString();
  if (step?.featureId) {
    next.hints_dismissed[step.featureId] = new Date().toISOString();
  }
  return next;
}

/** Jornada gamificada Caça-Preço no mapa concluída (sync Supabase). */
export const CACA_PRECO_MAP_JOURNEY_KEY = 'caca_preco_map';

/**
 * @param {CoachJourneyState} journey
 * @returns {boolean}
 */
export function isCacaPrecoMapJourneyCompleteInCoach(journey) {
  const j = normalizeCoachJourney(journey);
  return Boolean(j.hints_dismissed[CACA_PRECO_MAP_JOURNEY_KEY]);
}

/**
 * @param {CoachJourneyState} journey
 * @returns {CoachJourneyState}
 */
export function applyCacaPrecoMapJourneyComplete(journey) {
  const next = normalizeCoachJourney(journey);
  const now = new Date().toISOString();
  next.hints_dismissed[CACA_PRECO_MAP_JOURNEY_KEY] = now;
  next.feature_last_used.mapa = now;
  return next;
}

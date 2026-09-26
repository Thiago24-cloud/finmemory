export const PLAN_RANK = { free: 0, plus: 1, enterprise: 1, pro: 2, familia: 3 };

export const PLAN_LABELS = {
  free: 'Grátis',
  plus: 'Plus',
  enterprise: 'Enterprise',
  pro: 'Pro',
  familia: 'Família',
};

/** Mapeamento feature → plano mínimo requerido. */
export const FEATURE_PLANS = {
  radar: 'pro',
  nfce_ilimitado: 'pro',
  historico_completo: 'plus',
  categorias_ilimitadas: 'pro',
  /** Mais de 1 banco Open Finance (o 1º banco é grátis para todos). */
  open_finance_multi_bank: 'pro',
  scanner_ean: 'pro',
  relatorios: 'pro',
  suporte_prioritario: 'pro',
  familia_compartilhado: 'familia',
  /** Dashboard financeiro completo (Plus+). Free foca no mapa. */
  finance_dashboard: 'plus',
};

export function planRank(plan) {
  return PLAN_RANK[String(plan || 'free').toLowerCase()] ?? 0;
}

export function canAccessFeature(userPlan, feature) {
  const required = FEATURE_PLANS[feature];
  if (!required) return true;
  return planRank(userPlan) >= planRank(required);
}

function trialStillActive(session) {
  const ends = session?.user?.plan_trial_ends_at;
  if (!ends) return false;
  const t = new Date(ends).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/**
 * Plano efetivo: assinatura Stripe paga > trial local da preferência > plano BD.
 */
export function getEffectivePlan(session) {
  const rawPlan = String(session?.user?.plano || 'free').toLowerCase();
  const paidActive = Boolean(session?.user?.plano_ativo) && rawPlan !== 'free';
  if (paidActive) return rawPlan;

  const audience = String(session?.user?.preferred_audience || '').toLowerCase();
  const preferred = String(session?.user?.preferred_plan || '').toLowerCase();
  if (audience === 'consumer' && preferred && trialStillActive(session)) {
    if (['free', 'plus', 'pro', 'familia', 'enterprise'].includes(preferred)) {
      return preferred;
    }
  }

  return rawPlan === 'plus' || rawPlan === 'pro' || rawPlan === 'familia' || rawPlan === 'enterprise'
    ? rawPlan
    : 'free';
}

export function getPreferredAudience(session) {
  return String(session?.user?.preferred_audience || '').toLowerCase() || null;
}

export const PLAN_RANK = { free: 0, enterprise: 1, pro: 2, familia: 3 };

export const PLAN_LABELS = {
  free: 'Grátis',
  enterprise: 'Enterprise',
  pro: 'Pro',
  familia: 'Família',
};

/** Mapeamento feature → plano mínimo requerido. */
export const FEATURE_PLANS = {
  radar: 'pro',
  nfce_ilimitado: 'pro',
  historico_completo: 'pro',
  categorias_ilimitadas: 'pro',
  open_finance: 'pro',
  scanner_ean: 'pro',
  relatorios: 'pro',
  suporte_prioritario: 'pro',
  familia_compartilhado: 'familia',
};

export function planRank(plan) {
  return PLAN_RANK[String(plan || 'free').toLowerCase()] ?? 0;
}

export function canAccessFeature(userPlan, feature) {
  const required = FEATURE_PLANS[feature];
  if (!required) return true;
  return planRank(userPlan) >= planRank(required);
}

export function getEffectivePlan(session) {
  return String(session?.user?.plano || 'free').toLowerCase();
}

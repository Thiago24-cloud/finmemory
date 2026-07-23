import {
  canAccessFeature,
  getRestaurantPlan,
  planUpgradeMessage,
  suggestPlanForFeature,
  PANEL_TAB_FEATURES,
} from './storePlans';

/**
 * Guard de API: se a feature estiver bloqueada, responde 403 e retorna null.
 * Fail-open se schema ausente ou gates desligados.
 *
 * @param {object} auth — retorno de requireMerchantApi
 * @param {import('next').NextApiResponse} res
 * @param {string} featureKey
 */
export async function requireFeature(auth, res, featureKey) {
  if (!auth?.supabase || !auth?.store?.id) return auth;

  const allowed = await canAccessFeature(auth.supabase, auth.store.id, featureKey);
  if (allowed) return auth;

  const plan = await getRestaurantPlan(auth.supabase, auth.store.id);
  const suggested = await suggestPlanForFeature(auth.supabase, featureKey);
  const targetName = suggested?.name || plan.planName || 'superior';

  res.status(403).json({
    code: 'FEATURE_LOCKED',
    feature: featureKey,
    plan_code: plan.planCode,
    plan_status: plan.status,
    error: planUpgradeMessage(targetName),
    required_plan: suggested?.code || null,
    required_plan_name: targetName,
  });
  return null;
}

export function featureForPanelTab(tabId) {
  return PANEL_TAB_FEATURES[tabId] || null;
}

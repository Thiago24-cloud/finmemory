/**
 * Leitura de features do plano B2B na loja (fail-open se schema ausente).
 * Espelho leve de apps/retailer/lib/merchant/storePlans.js — sem criar trial.
 */

export const PLAN_DISPLAY_NAMES = {
  presenca_digital: 'Presença Digital',
  pedidos_diretos: 'Pedidos Diretos',
  estoque_margem: 'Estoque e Margem',
  gestao_completa: 'Gestão Completa',
};

export const FEATURE_UNLOCK_PLAN = {
  qr_code: 'presenca_digital',
  public_store_page: 'presenca_digital',
  digital_menu: 'presenca_digital',
  customer_registration: 'presenca_digital',
  price_map: 'presenca_digital',
  manual_support: 'presenca_digital',
  direct_orders: 'pedidos_diretos',
  pickup_orders: 'pedidos_diretos',
  local_delivery: 'pedidos_diretos',
  consumer_app_integration: 'pedidos_diretos',
  inventory_control: 'estoque_margem',
  receipt_import: 'estoque_margem',
  margin_calculation: 'estoque_margem',
  reports: 'estoque_margem',
  whatsapp_campaigns: 'gestao_completa',
  consumer_financial_history: 'gestao_completa',
};

function gatesEnabled() {
  const raw = process.env.STORE_FEATURE_GATES;
  if (raw === '0' || raw === 'false') return false;
  return true;
}

function resolveStatus(sub, now = new Date()) {
  if (!sub) return null;
  let status = sub.status;
  if (
    status === 'trialing' &&
    sub.trial_ends_at &&
    new Date(sub.trial_ends_at).getTime() < now.getTime()
  ) {
    status = 'expired';
  }
  return status;
}

function isAccessActive(status) {
  return status === 'trialing' || status === 'active';
}

/**
 * @returns {Promise<{
 *   features: string[],
 *   planCode: string|null,
 *   planName: string|null,
 *   accessActive: boolean,
 *   gatesEnabled: boolean,
 *   missingSchema: boolean,
 *   can: (featureKey: string) => boolean
 * }>}
 */
export async function getStoreFeatureAccess(supabase, storeId) {
  const open = {
    features: [],
    planCode: null,
    planName: null,
    accessActive: true,
    gatesEnabled: gatesEnabled(),
    missingSchema: false,
  };

  if (!supabase || !storeId) {
    return { ...open, can: () => true };
  }

  const { data: sub, error } = await supabase
    .from('store_subscriptions')
    .select('plan_code, status, trial_ends_at')
    .eq('store_id', storeId)
    .maybeSingle();

  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('store_subscriptions') || error.code === '42P01' || error.code === 'PGRST205') {
      return { ...open, missingSchema: true, can: () => true };
    }
    console.warn('[storePlanAccess]', error.message);
    return { ...open, missingSchema: true, can: () => true };
  }

  if (!sub) {
    return { ...open, can: () => true };
  }

  const status = resolveStatus(sub);
  const accessActive = isAccessActive(status);
  const { data: feats } = await supabase
    .from('store_plan_features')
    .select('feature_key')
    .eq('plan_code', sub.plan_code);

  const features = (feats || []).map((r) => r.feature_key);
  const planName = PLAN_DISPLAY_NAMES[sub.plan_code] || sub.plan_code;

  const info = {
    features,
    planCode: sub.plan_code,
    planName,
    accessActive,
    gatesEnabled: gatesEnabled(),
    missingSchema: false,
  };

  return {
    ...info,
    can(featureKey) {
      if (!featureKey) return true;
      if (!info.gatesEnabled || info.missingSchema) return true;
      if (!info.accessActive) return false;
      return info.features.includes(featureKey);
    },
  };
}

export function unlockPlanNameForFeature(featureKey) {
  const code = FEATURE_UNLOCK_PLAN[featureKey] || 'gestao_completa';
  return PLAN_DISPLAY_NAMES[code] || code;
}

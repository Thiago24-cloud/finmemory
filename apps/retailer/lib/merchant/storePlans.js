/**
 * Planos B2B FinMemory store (por loja = stores.id).
 * Independente de users.plano / Stripe Plus (app B2C).
 */

export const STORE_PLAN_CODES = [
  'presenca_digital',
  'pedidos_diretos',
  'estoque_margem',
  'gestao_completa',
];

export const STORE_SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired',
];

/** Mapeamento aba do painel → feature_key */
export const PANEL_TAB_FEATURES = {
  mapa: 'price_map',
  ofertas: 'public_store_page',
  insumos: 'inventory_control',
  cardapio: 'digital_menu',
  preparo: 'digital_menu',
  mesas: 'qr_code',
  codigos: 'qr_code',
  vendas: 'direct_orders',
  lista: 'price_map',
  cozinha: 'direct_orders',
  garcom: 'direct_orders',
  caixa: 'direct_orders',
  historico: 'reports',
  entrega: 'local_delivery',
  equipe: 'direct_orders',
};

export const TRIAL_DAYS = 30;
export const DEFAULT_TRIAL_PLAN = 'gestao_completa';

export const PLAN_DISPLAY_NAMES = {
  presenca_digital: 'Presença Digital',
  pedidos_diretos: 'Pedidos Diretos',
  estoque_margem: 'Estoque e Margem',
  gestao_completa: 'Gestão Completa',
};

/** Menor plano que libera cada feature (mensagem de upgrade). */
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

export const PANEL_TAB_LABELS = {
  mapa: 'Mapa de preços',
  ofertas: 'Dashboard / página da loja',
  insumos: 'Controle de estoque',
  cardapio: 'Cardápio digital',
  preparo: 'Preparo / cardápio',
  mesas: 'Mesas e QR Code',
  codigos: 'Códigos QR',
  vendas: 'Vendas e pedidos',
  lista: 'Lista e mapa de preços',
  cozinha: 'Pedidos (cozinha)',
  garcom: 'Pedidos (garçom)',
  caixa: 'Caixa / pedidos',
  historico: 'Relatórios e histórico',
  entrega: 'Entrega local',
  equipe: 'Equipe / pedidos',
};

function gatesEnabled() {
  const raw = process.env.STORE_FEATURE_GATES;
  if (raw === '0' || raw === 'false') return false;
  return true;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Normaliza status (expira trial vencido).
 */
export function resolveSubscriptionStatus(sub, now = new Date()) {
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

export function isSubscriptionAccessActive(status) {
  return status === 'trialing' || status === 'active';
}

/**
 * Garante assinatura/trial para a loja. Fail-soft se tabelas não existirem.
 * @returns {Promise<object|null>}
 */
export async function ensureStoreSubscription(supabase, storeId, opts = {}) {
  if (!supabase || !storeId) return null;
  const planCode = opts.planCode || DEFAULT_TRIAL_PLAN;
  const trialDays = opts.trialDays ?? TRIAL_DAYS;

  const { data: existing, error: readErr } = await supabase
    .from('store_subscriptions')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle();

  if (readErr) {
    const msg = String(readErr.message || '');
    if (msg.includes('store_subscriptions') || readErr.code === '42P01' || readErr.code === 'PGRST205') {
      return null;
    }
    console.warn('[storePlans] read subscription:', readErr.message);
    return null;
  }

  if (existing) {
    const status = resolveSubscriptionStatus(existing);
    if (status === 'expired' && existing.status === 'trialing') {
      const { data: updated } = await supabase
        .from('store_subscriptions')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .maybeSingle();
      return updated || { ...existing, status: 'expired' };
    }
    return existing;
  }

  const now = new Date();
  const trialEnds = addDays(now, trialDays);
  const row = {
    store_id: storeId,
    plan_code: planCode,
    status: 'trialing',
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnds.toISOString(),
    updated_at: now.toISOString(),
  };

  const { data: created, error: insErr } = await supabase
    .from('store_subscriptions')
    .insert(row)
    .select('*')
    .maybeSingle();

  if (insErr) {
    console.warn('[storePlans] create trial:', insErr.message);
    return null;
  }
  return created;
}

async function loadFeatureKeys(supabase, planCode) {
  const { data, error } = await supabase
    .from('store_plan_features')
    .select('feature_key')
    .eq('plan_code', planCode);
  if (error) {
    console.warn('[storePlans] features:', error.message);
    return [];
  }
  return (data || []).map((r) => r.feature_key);
}

async function loadPlanMeta(supabase, planCode) {
  const { data } = await supabase
    .from('store_plans')
    .select('code, name, description')
    .eq('code', planCode)
    .maybeSingle();
  return data || { code: planCode, name: planCode, description: null };
}

/**
 * Plano atual da loja + features.
 * @returns {Promise<{
 *   storeId: string,
 *   planCode: string|null,
 *   planName: string|null,
 *   status: string|null,
 *   trialStartedAt: string|null,
 *   trialEndsAt: string|null,
 *   features: string[],
 *   accessActive: boolean,
 *   gatesEnabled: boolean,
 *   missingSchema: boolean
 * }>}
 */
export async function getRestaurantPlan(supabase, restaurantId) {
  const base = {
    storeId: restaurantId,
    planCode: null,
    planName: null,
    status: null,
    trialStartedAt: null,
    trialEndsAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    features: [],
    accessActive: true,
    gatesEnabled: gatesEnabled(),
    missingSchema: false,
  };

  if (!supabase || !restaurantId) return base;

  const sub = await ensureStoreSubscription(supabase, restaurantId);
  if (!sub) {
    return { ...base, missingSchema: true, accessActive: true };
  }

  const status = resolveSubscriptionStatus(sub);
  const planMeta = await loadPlanMeta(supabase, sub.plan_code);
  const features = await loadFeatureKeys(supabase, sub.plan_code);
  const accessActive = isSubscriptionAccessActive(status);

  return {
    storeId: restaurantId,
    planCode: sub.plan_code,
    planName: planMeta.name || sub.plan_code,
    status,
    trialStartedAt: sub.trial_started_at || null,
    trialEndsAt: sub.trial_ends_at || null,
    currentPeriodStart: sub.current_period_start || null,
    currentPeriodEnd: sub.current_period_end || null,
    features,
    accessActive,
    gatesEnabled: gatesEnabled(),
    missingSchema: false,
  };
}

/**
 * @returns {Promise<boolean>}
 */
export async function canAccessFeature(supabase, restaurantId, featureKey) {
  if (!featureKey) return true;
  if (!gatesEnabled()) return true;

  const plan = await getRestaurantPlan(supabase, restaurantId);
  if (plan.missingSchema) return true;
  if (!plan.accessActive) return false;
  return plan.features.includes(featureKey);
}

/** Alias com assinatura pedida: canAccessFeature(restaurantId, featureKey) via admin client. */
export async function canAccessFeatureByStoreId(restaurantId, featureKey) {
  const { getSupabaseAdmin } = await import('../supabaseAdmin');
  const supabase = getSupabaseAdmin();
  if (!supabase) return true;
  return canAccessFeature(supabase, restaurantId, featureKey);
}

/** Alias: getRestaurantPlan(restaurantId) via admin client. */
export async function getRestaurantPlanByStoreId(restaurantId) {
  const { getSupabaseAdmin } = await import('../supabaseAdmin');
  const supabase = getSupabaseAdmin();
  return getRestaurantPlan(supabase, restaurantId);
}

export function planUpgradeMessage(planName) {
  const name = planName || 'superior';
  return `Essa funcionalidade está disponível no plano ${name}.`;
}

export function unlockPlanForFeature(featureKey) {
  const code = FEATURE_UNLOCK_PLAN[featureKey] || 'gestao_completa';
  return {
    code,
    name: PLAN_DISPLAY_NAMES[code] || code,
  };
}

/**
 * Cliente / UI: usa o payload de getRestaurantPlan (ou context.plan).
 */
export function clientCanAccessFeature(planInfo, featureKey) {
  if (!featureKey) return true;
  if (!planInfo || planInfo.missingSchema) return true;
  if (planInfo.gatesEnabled === false) return true;
  if (!planInfo.accessActive) return false;
  return Array.isArray(planInfo.features) && planInfo.features.includes(featureKey);
}

export function clientCanAccessPanelTab(planInfo, tabId) {
  const featureKey = PANEL_TAB_FEATURES[tabId];
  if (!featureKey) return true;
  return clientCanAccessFeature(planInfo, featureKey);
}

/**
 * Sugere o menor plano que inclui a feature (para mensagem).
 */
export async function suggestPlanForFeature(supabase, featureKey) {
  const staticSuggest = unlockPlanForFeature(featureKey);
  if (!supabase) return staticSuggest;
  try {
    const meta = await loadPlanMeta(supabase, staticSuggest.code);
    return { code: meta.code || staticSuggest.code, name: meta.name || staticSuggest.name };
  } catch {
    return staticSuggest;
  }
}

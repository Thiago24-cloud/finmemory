/**
 * Testes básicos sem Jest (retailer não tem runner).
 * Rode: node apps/retailer/lib/merchant/storePlans.test.cjs
 *
 * Espelha helpers puros de storePlans.js (sem Supabase).
 */

function resolveSubscriptionStatus(sub, now = new Date()) {
  if (!sub) return null;
  let status = sub.status;
  if (
    status === 'trialing' &&
    sub.trial_ends_at &&
    new Date(sub.trial_ends_at).getTime() < now.getTime()
  ) {
    return 'expired';
  }
  return status;
}

function isSubscriptionAccessActive(status) {
  return status === 'trialing' || status === 'active';
}

function planUpgradeMessage(planName) {
  return `Essa funcionalidade está disponível no plano ${planName || 'superior'}.`;
}

function clientCanAccessFeature(planInfo, featureKey) {
  if (!featureKey) return true;
  if (!planInfo || planInfo.missingSchema) return true;
  if (planInfo.gatesEnabled === false) return true;
  if (!planInfo.accessActive) return false;
  return Array.isArray(planInfo.features) && planInfo.features.includes(featureKey);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

assert(resolveSubscriptionStatus(null) === null);
assert(
  resolveSubscriptionStatus({
    status: 'trialing',
    trial_ends_at: '2099-01-01T00:00:00.000Z',
  }) === 'trialing'
);
assert(
  resolveSubscriptionStatus({
    status: 'trialing',
    trial_ends_at: '2020-01-01T00:00:00.000Z',
  }) === 'expired'
);
assert(isSubscriptionAccessActive('trialing') === true);
assert(isSubscriptionAccessActive('expired') === false);
assert(
  planUpgradeMessage('Pedidos Diretos') ===
    'Essa funcionalidade está disponível no plano Pedidos Diretos.'
);

const full = {
  features: ['qr_code'],
  accessActive: true,
  gatesEnabled: true,
  missingSchema: false,
};
assert(clientCanAccessFeature(full, 'qr_code') === true);
assert(clientCanAccessFeature(full, 'inventory_control') === false);
assert(clientCanAccessFeature({ missingSchema: true }, 'inventory_control') === true);

console.log('storePlans.test.cjs: ok');

/** Rotas de planos/pagamento — sem splash, onboarding modal nem bottom nav. */

const BILLING_EXACT = new Set(['/planos', '/checkout']);

export function isBillingRoute(pathname) {
  return Boolean(pathname && typeof pathname === 'string' && BILLING_EXACT.has(pathname));
}

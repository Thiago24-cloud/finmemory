/**
 * Mapeia Price IDs do Stripe → plano interno (checkout + webhook).
 * Aceita STRIPE_* (servidor) ou NEXT_PUBLIC_STRIPE_* (fallback).
 */

const PLANS = ['plus', 'pro', 'familia'];

export function isCheckoutPlan(value) {
  return PLANS.includes(String(value || '').toLowerCase());
}

export function checkoutPlanOrDefault(value) {
  const p = String(value || '').toLowerCase();
  return isCheckoutPlan(p) ? p : 'plus';
}

export function stripePriceIdsFromEnv() {
  return {
    plus:
      process.env.STRIPE_PLUS_PRICE_ID?.trim() ||
      process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID?.trim() ||
      '',
    pro:
      process.env.STRIPE_PRO_PRICE_ID?.trim() ||
      process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID?.trim() ||
      '',
    familia:
      process.env.STRIPE_FAMILIA_PRICE_ID?.trim() ||
      process.env.NEXT_PUBLIC_STRIPE_FAMILIA_PRICE_ID?.trim() ||
      '',
  };
}

/** @param {string | null | undefined} priceId */
export function planFromStripePriceId(priceId) {
  const id = String(priceId || '').trim();
  if (!id) return 'free';
  const m = stripePriceIdsFromEnv();
  if (id === m.plus) return 'plus';
  if (id === m.pro) return 'pro';
  if (id === m.familia) return 'familia';
  return null;
}

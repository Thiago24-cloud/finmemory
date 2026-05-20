import Stripe from 'stripe';

/** @returns {Stripe | null} */
export function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) return null;
  return new Stripe(secret);
}

export function stripeAppBaseUrl() {
  return (
    process.env.STRIPE_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'https://finmemory.com.br'
  ).replace(/\/$/, '');
}

export function isStripeConnectOrdersEnabled() {
  if (process.env.STRIPE_CONNECT_ORDERS_DISABLED === '1') return false;
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** Taxa da plataforma em % (0–30). Ex.: STRIPE_CONNECT_PLATFORM_FEE_PERCENT=5 */
export function stripeConnectPlatformFeePercent() {
  const n = Number(process.env.STRIPE_CONNECT_PLATFORM_FEE_PERCENT);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(30, n);
}

/**
 * @param {number} amountCents
 */
export function stripeConnectApplicationFeeCents(amountCents) {
  const pct = stripeConnectPlatformFeePercent();
  if (pct <= 0) return 0;
  return Math.round((amountCents * pct) / 100);
}

import { ensureHttpsUrl, RETAILER_PUBLIC_HTTPS_URL } from '../ensureHttps';

/**
 * URL canónica do app (checkout Stripe, portal, redirects OAuth).
 * Sempre HTTPS em produção (requisito Stone / cookies secure).
 */
export function stripeAppBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_BASE_URL,
    process.env.NEXTAUTH_URL,
    RETAILER_PUBLIC_HTTPS_URL,
  ];
  for (const raw of candidates) {
    const u = ensureHttpsUrl(raw);
    if (u) return u;
  }
  return '';
}

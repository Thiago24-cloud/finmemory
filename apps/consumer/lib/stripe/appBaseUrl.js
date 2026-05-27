/**
 * URL canónica do app (checkout Stripe, portal, redirects OAuth).
 * Em produção: preferir NEXT_PUBLIC_APP_URL (ex.: https://finmemory.com.br).
 */
export function stripeAppBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_BASE_URL,
    process.env.NEXTAUTH_URL,
    'https://finmemory.com.br',
  ];
  for (const raw of candidates) {
    const u = String(raw || '').trim();
    if (u.startsWith('http://') || u.startsWith('https://')) {
      return u.replace(/\/$/, '');
    }
  }
  return '';
}

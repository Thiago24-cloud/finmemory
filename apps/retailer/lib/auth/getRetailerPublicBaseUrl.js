import { ensureHttpsUrl, RETAILER_CLOUD_RUN_HTTPS_URL } from '../ensureHttps';

/**
 * URL pública do app lojista para links em e-mail.
 * Evita parceiros.finmemory.com.br (DNS quebrado → 404).
 */
export function getRetailerPublicBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_RETAILER_APP_URL,
    process.env.NEXT_PUBLIC_FINMEMORY_RETAILER_URL,
    process.env.NEXTAUTH_URL,
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];
  for (const raw of candidates) {
    const u = ensureHttpsUrl(raw);
    if (!u) continue;
    if (/parceiros\.finmemory\.com\.br/i.test(u)) continue;
    return u;
  }
  return RETAILER_CLOUD_RUN_HTTPS_URL;
}

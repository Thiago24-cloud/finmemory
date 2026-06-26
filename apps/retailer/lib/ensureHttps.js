/**
 * Garante URL pública com HTTPS (requisito Stone SDK / cookies secure).
 * Mantém http:// apenas em localhost.
 */
export function ensureHttpsUrl(raw, fallback = '') {
  const u = String(raw || fallback || '').trim();
  if (!u) return '';
  if (/^https:\/\//i.test(u)) return u.replace(/\/$/, '');
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(u)) return u.replace(/\/$/, '');
  if (/^http:\/\//i.test(u)) return `https://${u.slice('http://'.length)}`.replace(/\/$/, '');
  if (u.startsWith('//')) return `https:${u}`.replace(/\/$/, '');
  return `https://${u.replace(/^\/+/, '')}`.replace(/\/$/, '');
}

export const RETAILER_CLOUD_RUN_HTTPS_URL =
  process.env.FINMEMORY_RETAILER_CLOUD_RUN_URL ||
  'https://finmemory-retailer-836908221936.southamerica-east1.run.app';

export const RETAILER_PUBLIC_HTTPS_URL = ensureHttpsUrl(
  process.env.NEXT_PUBLIC_RETAILER_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL,
  RETAILER_CLOUD_RUN_HTTPS_URL,
);

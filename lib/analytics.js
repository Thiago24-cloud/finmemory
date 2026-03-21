/**
 * Analytics (GA4) - helpers para gtag.
 * Depende do GoogleAnalytics (@next/third-parties) carregado no _app.
 * Só envia dados em hosts de produção (evita spam de preview/staging/local no GA).
 */

export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_ID || 'G-K783HNBGE8';

/** Hostnames onde o GA pode inicializar (sem protocolo, lowercase). */
const DEFAULT_GA_ALLOWED_HOSTS = [
  'finmemory.com.br',
  'www.finmemory.com.br',
  'finmemory-836908221936.southamerica-east1.run.app',
  'finmemory-667c3.web.app',
  'finmemory-clos3kpinq-rj.a.run.app',
];

function getGaAllowedHostsList() {
  const raw = process.env.NEXT_PUBLIC_GA_ALLOWED_HOSTS;
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_GA_ALLOWED_HOSTS;
}

/**
 * @param {string} [hostname] - default: window.location.hostname no cliente
 */
export function isGaAllowedHost(hostname) {
  if (typeof window === 'undefined') return false;
  const raw =
    hostname != null && hostname !== ''
      ? hostname
      : window.location.hostname;
  const h = String(raw || '').toLowerCase();
  if (!h) return false;
  return getGaAllowedHostsList().includes(h);
}

function canSendGa() {
  return (
    typeof window !== 'undefined' &&
    isGaAllowedHost() &&
    typeof window.gtag === 'function'
  );
}

export function setUserId(userId) {
  if (!canSendGa()) return;
  window.gtag('config', GA_MEASUREMENT_ID, { user_id: userId });
}

export function setUserProperties(properties) {
  if (!canSendGa()) return;
  window.gtag('set', 'user_properties', properties);
}

export function trackEvent(name, params = {}) {
  if (!canSendGa()) return;
  window.gtag('event', name, params);
}

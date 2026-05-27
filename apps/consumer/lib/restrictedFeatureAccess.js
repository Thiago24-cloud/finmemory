/**
 * Recursos em rollout gradual — visíveis só para allowlist (time interno).
 * - Caça-preço / mapa de preços (/mapa)
 * - Lista de compras (/shopping-list)
 * - Missões (/missoes)
 * - Código de barras (/scan-product)
 *
 * FINMEMORY_PUBLIC_ACCESS controla login aberto (privateBetaAllowlist), não estas features.
 */

export const FINMEMORY_DEFAULT_RESTRICTED_EMAIL = 'finmemory.oficial@gmail.com';

/** Rotas bloqueadas para quem não está na allowlist (SSR redireciona para /em-breve). */
export const RESTRICTED_FEATURE_ROUTES = [
  '/mapa',
  '/scan-product',
  '/shopping-list',
  '/missoes',
];

function parseEmailList(raw) {
  if (raw == null || typeof raw !== 'string') return [];
  return raw
    .split(/[,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Prioridade:
 * - FINMEMORY_RESTRICTED_FEATURE_EMAILS (servidor)
 * - NEXT_PUBLIC_RESTRICTED_FEATURE_EMAILS (cliente + servidor)
 * - FINMEMORY_ADMIN_EMAILS (fallback legado)
 * - e-mail oficial
 */
export function getRestrictedFeatureAllowlist() {
  const restrictedServerList = parseEmailList(process.env.FINMEMORY_RESTRICTED_FEATURE_EMAILS);
  if (restrictedServerList.length) return restrictedServerList;

  const restrictedPublicList = parseEmailList(process.env.NEXT_PUBLIC_RESTRICTED_FEATURE_EMAILS);
  if (restrictedPublicList.length) return restrictedPublicList;

  const adminList = parseEmailList(process.env.FINMEMORY_ADMIN_EMAILS);
  if (adminList.length) return adminList;

  return [FINMEMORY_DEFAULT_RESTRICTED_EMAIL];
}

export function canUseRestrictedFeatures(email) {
  if (!email || typeof email !== 'string') return false;
  const allowlist = getRestrictedFeatureAllowlist();
  return allowlist.includes(email.trim().toLowerCase());
}

export function isRestrictedFeatureRoute(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return RESTRICTED_FEATURE_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );
}

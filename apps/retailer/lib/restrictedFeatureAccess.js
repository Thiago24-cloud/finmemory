/**
 * Recursos em rollout gradual — visíveis só para allowlist (time interno).
 * @see apps/consumer/lib/restrictedFeatureAccess.js
 */

export const FINMEMORY_DEFAULT_RESTRICTED_EMAIL = 'finmemory.oficial@gmail.com';

export const RESTRICTED_FEATURE_ROUTES = [
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

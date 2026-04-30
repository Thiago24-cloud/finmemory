/**
 * Recursos temporariamente restritos ao time/admin:
 * - mapa de preços
 * - código de barras
 * - parceria
 * - lista de compras
 *
 * Regra:
 * 1) Se houver allowlist explícita, só ela acessa.
 * 2) Se não houver, mantém lockdown no e-mail oficial.
 */

export const FINMEMORY_DEFAULT_RESTRICTED_EMAIL = 'finmemory.oficial@gmail.com';

function parseEmailList(raw) {
  if (raw == null || typeof raw !== 'string') return [];
  return raw
    .split(/[,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Cliente/SSR: lista normalizada de e-mails que podem usar recursos restritos.
 * Prioridade:
 * - FINMEMORY_ADMIN_EMAILS
 * - FINMEMORY_RESTRICTED_FEATURE_EMAILS
 * - NEXT_PUBLIC_RESTRICTED_FEATURE_EMAILS
 * - fallback oficial
 */
export function getRestrictedFeatureAllowlist() {
  const adminList = parseEmailList(process.env.FINMEMORY_ADMIN_EMAILS);
  if (adminList.length) return adminList;

  const restrictedServerList = parseEmailList(process.env.FINMEMORY_RESTRICTED_FEATURE_EMAILS);
  if (restrictedServerList.length) return restrictedServerList;

  const restrictedPublicList = parseEmailList(process.env.NEXT_PUBLIC_RESTRICTED_FEATURE_EMAILS);
  if (restrictedPublicList.length) return restrictedPublicList;

  return [FINMEMORY_DEFAULT_RESTRICTED_EMAIL];
}

export function canUseRestrictedFeatures(email) {
  if (!email || typeof email !== 'string') return false;
  const allowlist = getRestrictedFeatureAllowlist();
  return allowlist.includes(email.trim().toLowerCase());
}


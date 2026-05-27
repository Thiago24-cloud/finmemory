import { APP_ROLE_CLIENT, APP_ROLE_MERCHANT, type AppRole } from '../rbac/appRole';
import { postLoginPathForRole } from '../rbac/appRole';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/** URL pública do app consumidor. */
export function getConsumerAppBaseUrl(): string {
  return stripTrailingSlash(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      'https://finmemory.com.br'
  );
}

/** URL pública do app lojista. */
export function getRetailerAppBaseUrl(): string {
  return stripTrailingSlash(
    process.env.NEXT_PUBLIC_RETAILER_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      'https://parceiros.finmemory.com.br'
  );
}

/** Destino padrão pós-login dentro do app atual. */
export function postLoginPathForAppRole(role: AppRole): string {
  return postLoginPathForRole(role);
}

/** Cross-app: consumidor logado como lojista → app retailer. */
export function postLoginUrlForAppRole(role: AppRole, opts?: { consumerOrigin?: boolean }): string {
  const path = postLoginPathForRole(role);
  if (role === APP_ROLE_MERCHANT && !opts?.consumerOrigin) {
    return `${getRetailerAppBaseUrl()}${path}`;
  }
  if (role === APP_ROLE_CLIENT && opts?.consumerOrigin === false) {
    return `${getConsumerAppBaseUrl()}/dashboard`;
  }
  return path.startsWith('http') ? path : path;
}

export { APP_ROLE_CLIENT, APP_ROLE_MERCHANT };

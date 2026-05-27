import {
  ACCOUNT_TYPE_VAREJISTA,
  USER_ROLE_RETAILER,
  type AccountType,
  type UserRole,
} from './userType';

/** Role de app no monorepo (consumidor vs varejista). */
export type AppRole = 'client' | 'merchant';

export const APP_ROLE_CLIENT = 'client' as const;
export const APP_ROLE_MERCHANT = 'merchant' as const;

export function accountTypeToAppRole(accountType: AccountType | string | null | undefined): AppRole {
  return accountType === ACCOUNT_TYPE_VAREJISTA ? APP_ROLE_MERCHANT : APP_ROLE_CLIENT;
}

export function userRoleToAppRole(userRole: UserRole | string | null | undefined): AppRole {
  return userRole === USER_ROLE_RETAILER ? APP_ROLE_MERCHANT : APP_ROLE_CLIENT;
}

export function resolveAppRole(user: {
  account_type?: string;
  userRole?: string;
  merchantStoreId?: string | null;
} | null | undefined): AppRole {
  if (!user) return APP_ROLE_CLIENT;
  if (user.merchantStoreId) return APP_ROLE_MERCHANT;
  return accountTypeToAppRole(user.account_type ?? user.userRole);
}

/** Caminho padrão pós-login por app (Fase 4: apps separados). */
export function postLoginPathForRole(role: AppRole): string {
  return role === APP_ROLE_MERCHANT ? '/parceiros/painel' : '/dashboard';
}

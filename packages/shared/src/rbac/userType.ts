export type AccountType = 'consumidor' | 'varejista';
export type UserRole = 'consumer' | 'retailer';

export const ACCOUNT_TYPE_CONSUMIDOR = 'consumidor' as const;
export const ACCOUNT_TYPE_VAREJISTA = 'varejista' as const;

export const USER_ROLE_CONSUMER = 'consumer' as const;
export const USER_ROLE_RETAILER = 'retailer' as const;

export function normalizeAccountType(value: string | null | undefined): AccountType {
  return value === ACCOUNT_TYPE_VAREJISTA ? ACCOUNT_TYPE_VAREJISTA : ACCOUNT_TYPE_CONSUMIDOR;
}

export function accountTypeToUserRole(
  value: AccountType | UserRole | string | null | undefined
): UserRole {
  if (value === ACCOUNT_TYPE_VAREJISTA || value === USER_ROLE_RETAILER) return USER_ROLE_RETAILER;
  return USER_ROLE_CONSUMER;
}

export function userRoleToAccountType(role: UserRole | AccountType | string): AccountType {
  return role === USER_ROLE_RETAILER || role === ACCOUNT_TYPE_VAREJISTA
    ? ACCOUNT_TYPE_VAREJISTA
    : ACCOUNT_TYPE_CONSUMIDOR;
}

export function isVarejistaUser(
  user: { account_type?: string; userType?: string; userRole?: string } | null | undefined
): boolean {
  const t = user?.account_type ?? user?.userType ?? user?.userRole;
  return normalizeAccountType(t) === ACCOUNT_TYPE_VAREJISTA || t === USER_ROLE_RETAILER;
}

export function getUserRoleFromSessionUser(
  user: { account_type?: string; userRole?: string } | null | undefined
): UserRole {
  return accountTypeToUserRole(user?.account_type ?? user?.userRole);
}

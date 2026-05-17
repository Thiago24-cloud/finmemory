/** @typedef {'consumidor' | 'varejista'} AccountType */
/** @typedef {'consumer' | 'retailer'} UserRole */

export const ACCOUNT_TYPE_CONSUMIDOR = 'consumidor';
export const ACCOUNT_TYPE_VAREJISTA = 'varejista';

export const USER_ROLE_CONSUMER = 'consumer';
export const USER_ROLE_RETAILER = 'retailer';

/**
 * @param {string | null | undefined} value
 * @returns {AccountType}
 */
export function normalizeAccountType(value) {
  return value === ACCOUNT_TYPE_VAREJISTA ? ACCOUNT_TYPE_VAREJISTA : ACCOUNT_TYPE_CONSUMIDOR;
}

/**
 * @param {AccountType | UserRole | string | null | undefined} value
 * @returns {UserRole}
 */
export function accountTypeToUserRole(value) {
  if (value === ACCOUNT_TYPE_VAREJISTA || value === USER_ROLE_RETAILER) return USER_ROLE_RETAILER;
  return USER_ROLE_CONSUMER;
}

/**
 * @param {UserRole | AccountType | string} role
 * @returns {AccountType}
 */
export function userRoleToAccountType(role) {
  return role === USER_ROLE_RETAILER || role === ACCOUNT_TYPE_VAREJISTA
    ? ACCOUNT_TYPE_VAREJISTA
    : ACCOUNT_TYPE_CONSUMIDOR;
}

/**
 * @param {{ account_type?: string; userType?: string; userRole?: string } | null | undefined} user
 */
export function isVarejistaUser(user) {
  const t = user?.account_type ?? user?.userType ?? user?.userRole;
  return normalizeAccountType(t) === ACCOUNT_TYPE_VAREJISTA || t === USER_ROLE_RETAILER;
}

/**
 * @param {{ account_type?: string; userRole?: string } | null | undefined} user
 * @returns {UserRole}
 */
export function getUserRoleFromSessionUser(user) {
  return accountTypeToUserRole(user?.account_type ?? user?.userRole);
}

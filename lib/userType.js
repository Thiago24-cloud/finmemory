/** @typedef {'consumidor' | 'varejista'} AccountType */

export const ACCOUNT_TYPE_CONSUMIDOR = 'consumidor';
export const ACCOUNT_TYPE_VAREJISTA = 'varejista';

/**
 * @param {string | null | undefined} value
 * @returns {AccountType}
 */
export function normalizeAccountType(value) {
  return value === ACCOUNT_TYPE_VAREJISTA ? ACCOUNT_TYPE_VAREJISTA : ACCOUNT_TYPE_CONSUMIDOR;
}

/**
 * @param {{ account_type?: string; userType?: string } | null | undefined} user
 */
export function isVarejistaUser(user) {
  const t = user?.account_type ?? user?.userType;
  return normalizeAccountType(t) === ACCOUNT_TYPE_VAREJISTA;
}

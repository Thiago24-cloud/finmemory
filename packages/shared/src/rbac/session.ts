import {
  APP_ROLE_CLIENT,
  APP_ROLE_MERCHANT,
  accountTypeToAppRole,
  resolveAppRole,
  type AppRole,
} from './appRole';
import { USER_ROLE_RETAILER, getUserRoleFromSessionUser, type UserRole } from './userType';

export type SessionUserLike = {
  account_type?: string | null;
  userRole?: string | null;
  merchantStoreId?: string | null;
  supabaseId?: string | null;
} | null | undefined;

/** Role de app a partir da sessão NextAuth. */
export function resolveAppRoleFromSession(user: SessionUserLike): AppRole {
  return resolveAppRole(user ?? undefined);
}

export function resolveUserRoleFromSession(user: SessionUserLike): UserRole {
  return getUserRoleFromSessionUser(user ?? undefined);
}

export function isMerchantSession(user: SessionUserLike): boolean {
  return resolveAppRoleFromSession(user) === APP_ROLE_MERCHANT;
}

export function isConsumerSession(user: SessionUserLike): boolean {
  return resolveAppRoleFromSession(user) === APP_ROLE_CLIENT;
}

/** Lojista com loja vinculada na sessão (painel operacional). */
export function canOpenMerchantPanel(user: SessionUserLike): boolean {
  if (!user?.supabaseId) return false;
  if (user.merchantStoreId) return true;
  return resolveUserRoleFromSession(user) === USER_ROLE_RETAILER;
}

export { accountTypeToAppRole, APP_ROLE_CLIENT, APP_ROLE_MERCHANT };

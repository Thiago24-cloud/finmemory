'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  USER_ROLE_CONSUMER,
  USER_ROLE_RETAILER,
  accountTypeToUserRole,
  getUserRoleFromSessionUser,
  isVarejistaUser,
} from '../lib/userType';

/** @typedef {import('../lib/userType').UserRole} UserRole */

const UserRoleContext = createContext({
  userRole: USER_ROLE_CONSUMER,
  isRetailer: false,
  isConsumer: true,
  loading: true,
  needsSelection: false,
  setUserRole: async () => {},
  refreshUserRole: async () => {},
});

export function UserRoleProvider({ children }) {
  const { data: session, status, update } = useSession();
  const [userRole, setUserRoleState] = useState(USER_ROLE_CONSUMER);
  const [loading, setLoading] = useState(true);
  const [needsSelection, setNeedsSelection] = useState(false);

  const syncFromSession = useCallback(() => {
    if (status !== 'authenticated' || !session?.user?.supabaseId) {
      setUserRoleState(USER_ROLE_CONSUMER);
      setNeedsSelection(false);
      setLoading(status === 'loading');
      return;
    }
    const role = getUserRoleFromSessionUser(session.user);
    setUserRoleState(role);
    setLoading(false);
  }, [session?.user, status]);

  const refreshUserRole = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.supabaseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/user/account-type');
      const data = await res.json();
      if (res.ok) {
        setNeedsSelection(Boolean(data.needsSelection));
        setUserRoleState(data.userRole || USER_ROLE_CONSUMER);
      }
    } catch {
      syncFromSession();
    } finally {
      setLoading(false);
    }
  }, [session?.user?.supabaseId, status, syncFromSession]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.supabaseId) {
      syncFromSession();
      return;
    }
    void refreshUserRole();
  }, [status, session?.user?.supabaseId, refreshUserRole, syncFromSession]);

  const setUserRole = useCallback(
    async (role) => {
      const res = await fetch('/api/user/account-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível salvar o perfil.');
      }
      const nextRole = data.userRole || role;
      setUserRoleState(nextRole);
      setNeedsSelection(false);
      try {
        await update({
          account_type: data.account_type,
          userRole: nextRole,
        });
      } catch (e) {
        console.warn('[UserRoleProvider] session update:', e);
      }
      return data;
    },
    [update]
  );

  const value = useMemo(
    () => ({
      userRole,
      isRetailer: userRole === USER_ROLE_RETAILER,
      isConsumer: userRole === USER_ROLE_CONSUMER,
      loading,
      needsSelection,
      setUserRole,
      refreshUserRole,
    }),
    [userRole, loading, needsSelection, setUserRole, refreshUserRole]
  );

  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
}

export function useUserRole() {
  return useContext(UserRoleContext);
}

/** Compatível com helpers existentes */
export function useIsVarejista() {
  const { userRole, loading } = useUserRole();
  return {
    isVarejista: userRole === USER_ROLE_RETAILER,
    loading,
  };
}

export function useUserRoleFromSession() {
  const { data: session } = useSession();
  return getUserRoleFromSessionUser(session?.user);
}

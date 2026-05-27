'use client';

import { createContext, useContext, useMemo } from 'react';
import { USER_ROLE_CONSUMER } from '../lib/userType';

const UserRoleContext = createContext({
  userRole: USER_ROLE_CONSUMER,
  isRetailer: false,
  isConsumer: true,
  loading: false,
  needsSelection: false,
  setUserRole: async () => {},
  refreshUserRole: async () => {},
});

/** App consumidor — role fixa em consumer (lojista migra para apps/retailer). */
export function UserRoleProvider({ children }) {
  const value = useMemo(
    () => ({
      userRole: USER_ROLE_CONSUMER,
      isRetailer: false,
      isConsumer: true,
      loading: false,
      needsSelection: false,
      setUserRole: async () => {},
      refreshUserRole: async () => {},
    }),
    []
  );

  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
}

export function useUserRole() {
  return useContext(UserRoleContext);
}

export function useIsVarejista() {
  return { isVarejista: false, loading: false };
}

export function useUserRoleFromSession() {
  return USER_ROLE_CONSUMER;
}

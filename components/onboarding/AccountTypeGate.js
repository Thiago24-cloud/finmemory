'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useUserRole } from '../../contexts/UserRoleContext';

/**
 * Redireciona para /escolher-perfil quando o utilizador ainda não escolheu Consumidor vs Varejista.
 */
export function AccountTypeGate({ children }) {
  const router = useRouter();
  const { status } = useSession();
  const { needsSelection, loading } = useUserRole();

  useEffect(() => {
    if (status !== 'authenticated' || loading) return;

    const path = router.pathname;
    if (needsSelection && path !== '/escolher-perfil') {
      void router.replace('/escolher-perfil');
      return;
    }
    if (!needsSelection && path === '/escolher-perfil') {
      void router.replace('/dashboard');
    }
  }, [status, loading, needsSelection, router]);

  return <>{children}</>;
}

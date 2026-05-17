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

  const path = router.pathname;
  const blocking =
    status === 'authenticated' &&
    loading &&
    path !== '/escolher-perfil' &&
    path !== '/login';

  if (blocking) {
    return (
      <div className="min-h-screen bg-[#030508] flex items-center justify-center">
        <p className="text-sm text-muted-foreground m-0">Carregando…</p>
      </div>
    );
  }

  return <>{children}</>;
}

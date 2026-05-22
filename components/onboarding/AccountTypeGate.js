'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useUserRole } from '../../contexts/UserRoleContext';
import { isPartnerRoute } from '../../lib/marketingRoutes';

/**
 * Redireciona para /escolher-perfil quando o utilizador ainda não escolheu Consumidor vs Varejista.
 */
export function AccountTypeGate({ children }) {
  const router = useRouter();
  const { status } = useSession();
  const { needsSelection, loading } = useUserRole();
  const path = router.pathname || '';
  const skipPartner = isPartnerRoute(path);

  useEffect(() => {
    if (skipPartner) return;
    if (status !== 'authenticated' || loading) return;

    const currentPath = router.pathname;
    if (needsSelection && currentPath !== '/escolher-perfil') {
      void router.replace('/escolher-perfil');
      return;
    }
    if (!needsSelection && currentPath === '/escolher-perfil') {
      void router.replace('/dashboard');
    }
  }, [skipPartner, status, loading, needsSelection, router]);

  if (skipPartner) {
    return <>{children}</>;
  }

  const blocking =
    status === 'authenticated' &&
    loading &&
    path !== '/escolher-perfil' &&
    path !== '/login' &&
    path !== '/planos' &&
    path !== '/checkout';

  if (blocking) {
    return (
      <div className="min-h-screen bg-[#030508] flex items-center justify-center">
        <p className="text-sm text-muted-foreground m-0">Carregando…</p>
      </div>
    );
  }

  return <>{children}</>;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

/**
 * PWA e sessão ativa: a landing (/) não redireciona sozinha no servidor em todos os casos.
 * Quem já entrou e reabre o app na home vai para o dashboard.
 */
export function AuthenticatedHomeRedirect() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated') return;
    const userId = session?.user?.supabaseId;
    if (!userId) return;
    if (router.query?.msg === 'nao-cadastrado') return;
    void router.replace('/mapa');
  }, [status, session?.user?.supabaseId, router.query?.msg, router]);

  return null;
}

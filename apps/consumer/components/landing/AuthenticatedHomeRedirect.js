'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

/**
 * PWA / sessão ativa na landing: vai para o home do plano escolhido (não força /mapa).
 */
export function AuthenticatedHomeRedirect() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated') return;
    const userId = session?.user?.supabaseId;
    if (!userId) return;
    if (router.query?.msg === 'nao-cadastrado') return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/app-home');
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const home = data.home || '/inicio';
        if (/^https?:\/\//i.test(home)) {
          window.location.href = home;
          return;
        }
        void router.replace(home);
      } catch {
        if (!cancelled) void router.replace('/inicio');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.supabaseId, router.query?.msg, router]);

  return null;
}

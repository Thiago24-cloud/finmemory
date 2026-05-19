'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { WelcomeBackModal } from './WelcomeBackModal';
import { useUserRole } from '../../contexts/UserRoleContext';

const SESSION_STORAGE_KEY = 'finmemory_session_check_v1';

/**
 * Uma vez por sessão do browser: processa streak/login e exibe Welcome Back se 48h+ ausente.
 */
export function WelcomeBackGate({ children }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { needsSelection } = useUserRole();
  const ranRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState(null);

  const skipPaths = ['/', '/login', '/signup', '/auth-error', '/escolher-perfil', '/parceiros', '/parceiros/painel'];

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.supabaseId) return;
    if (needsSelection) return;
    if (skipPaths.includes(router.pathname)) return;
    if (typeof window === 'undefined') return;
    if (ranRef.current) return;
    if (window.sessionStorage.getItem(SESSION_STORAGE_KEY)) return;

    ranRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/gamification/session-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (cancelled || !res.ok) return;

        window.sessionStorage.setItem(SESSION_STORAGE_KEY, String(Date.now()));

        if (data.show_welcome_back) {
          setPayload(data);
          setOpen(true);
        }
      } catch (e) {
        console.warn('[WelcomeBackGate]', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.supabaseId, needsSelection, router.pathname]);

  const dismiss = useCallback(async () => {
    setOpen(false);
    try {
      await fetch('/api/gamification/session-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss_welcome_back: true }),
      });
    } catch (_) {
      /* ignore */
    }
  }, []);

  const goMissions = useCallback(() => {
    setOpen(false);
    void dismiss();
    router.push('/missoes');
  }, [dismiss, router]);

  return (
    <>
      {children}
      <WelcomeBackModal
        open={open}
        displayName={payload?.display_name || session?.user?.name?.split(/\s+/)[0] || 'Jogador'}
        currentStreak={payload?.current_streak ?? 0}
        bonusCopy={
          payload?.bonus_copy ||
          'Para recuperar o ritmo, sua próxima missão diária vai te dar DOBRO de XP hoje!'
        }
        onDismiss={dismiss}
        onCta={goMissions}
      />
    </>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { GuidedOnboarding } from './GuidedOnboarding';
import { useOnboardingTour } from '../../contexts/OnboardingTourContext';
import { isGuidedOnboardingRoute } from '../../lib/onboarding/guidedOnboardingRoutes';

const LAYOUT_DELAY_MS = 700;
const WELCOME_BACK_WAIT_MS = 3200;
const SESSION_CHECK_KEY = 'finmemory_session_check_v1';

/**
 * Porta global: uma dica por vez (intro progressiva ou reengajamento por feature inativa).
 */
export function OnboardingGuideGate() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { roleLoading, isConsumer } = useOnboardingTour();
  const [payload, setPayload] = useState(null);
  const [ready, setReady] = useState(false);

  const userId = useMemo(() => {
    if (session?.user?.supabaseId) return session.user.supabaseId;
    if (typeof window !== 'undefined') return window.localStorage.getItem('user_id');
    return null;
  }, [session?.user?.supabaseId]);

  const routeEligible = isGuidedOnboardingRoute(router.pathname);
  const canFetch =
    status === 'authenticated' && userId && routeEligible && !roleLoading && isConsumer;

  useEffect(() => {
    if (!canFetch) {
      setPayload(null);
      setReady(false);
      return undefined;
    }

    let cancelled = false;
    let layoutTimer;
    let waitTimer;

    const loadHint = async () => {
      try {
        const r = await fetch('/api/user/coach-journey', { credentials: 'include' });
        if (!r.ok || cancelled) return;
        const j = await r.json();
        if (!j.show || !j.step) {
          setPayload(null);
          return;
        }
        setPayload({
          mode: j.mode || 'intro',
          step: j.step,
          reason: j.reason,
        });
        layoutTimer = window.setTimeout(() => {
          if (!cancelled) setReady(true);
        }, LAYOUT_DELAY_MS);
      } catch {
        /* rede */
      }
    };

    const sessionChecked =
      typeof window !== 'undefined' && window.sessionStorage.getItem(SESSION_CHECK_KEY);

    if (sessionChecked) {
      void loadHint();
    } else {
      waitTimer = window.setTimeout(() => {
        if (!cancelled) void loadHint();
      }, WELCOME_BACK_WAIT_MS);
    }

    return () => {
      cancelled = true;
      if (layoutTimer) window.clearTimeout(layoutTimer);
      if (waitTimer) window.clearTimeout(waitTimer);
    };
  }, [canFetch, router.pathname]);

  const handleComplete = () => {
    setPayload(null);
    setReady(false);
  };

  if (!payload?.step || !ready) return null;

  return (
    <GuidedOnboarding
      userId={userId}
      steps={[payload.step]}
      mode={payload.mode}
      onComplete={handleComplete}
    />
  );
}

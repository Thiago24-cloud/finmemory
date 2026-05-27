'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { featureIdFromRoute } from '../../lib/onboarding/featureRouteMap';

/**
 * Registra visitas a rotas-chave para o motor de reengajamento (coach journey).
 */
export function FeatureUsageRecorder() {
  const router = useRouter();
  const { status } = useSession();
  const lastSent = useRef('');

  useEffect(() => {
    if (status !== 'authenticated') return undefined;

    const record = (pathname) => {
      const featureId = featureIdFromRoute(pathname);
      if (!featureId) return;
      const key = `${featureId}:${pathname}`;
      if (lastSent.current === key) return;
      lastSent.current = key;
      void fetch('/api/user/coach-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'record_feature', featureId }),
      }).catch(() => {});
    };

    record(router.pathname);
    const onDone = (url) => {
      const path = typeof url === 'string' ? url.split('?')[0] : router.pathname;
      record(path);
    };
    router.events.on('routeChangeComplete', onDone);
    return () => router.events.off('routeChangeComplete', onDone);
  }, [router.events, router.pathname, status]);

  return null;
}

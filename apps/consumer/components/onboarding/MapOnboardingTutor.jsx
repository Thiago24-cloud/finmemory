'use client';

import { useCallback, useEffect, useState } from 'react';
import { TutorOverlay } from './TutorOverlay';
import {
  isMapOnboardingDoneLocal,
  setMapOnboardingDoneLocal,
} from '../../lib/onboarding/mapOnboardingStorage';
import { hasOpenedMapOnboarding } from '../../lib/onboarding/userOnboardingProgress';

const MAP_TUTOR_COPY =
  'Esse é o nosso Caça-Preço. Aqui você visualiza os produtos validados e cadastrados na região em tempo real para economizar!';

function firstNameFromDisplayName(name) {
  const s = String(name || '').trim();
  if (!s) return null;
  return s.split(/\s+/)[0] || null;
}

/**
 * Tutorial do mapa na primeira visita (`onboarding_progress.map_opened`).
 * Equivalente web do MapScreen + TutorOverlay (React Native).
 */
export function MapOnboardingTutor({ userId, userName, enabled = true }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || !userId) {
      setVisible(false);
      return undefined;
    }

    if (isMapOnboardingDoneLocal(userId)) {
      setVisible(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const r = await fetch('/api/user/onboarding', { credentials: 'include' });
        if (!r.ok || cancelled) return;
        const j = await r.json();
        if (cancelled) return;
        if (hasOpenedMapOnboarding(j.onboarding_progress)) {
          setMapOnboardingDoneLocal(userId);
          return;
        }
        setVisible(true);
      } catch {
        if (!cancelled) setVisible(true);
      }
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, userId]);

  const handleClose = useCallback(async () => {
    setVisible(false);
    if (userId) setMapOnboardingDoneLocal(userId);

    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: 'map_opened', value: true }),
      });
    } catch {
      /* rede — localStorage já marcou */
    }
  }, [userId]);

  if (!enabled || !visible) return null;

  const first = firstNameFromDisplayName(userName);
  const text = first
    ? `Fala ${first}! ${MAP_TUTOR_COPY}`
    : `Fala! ${MAP_TUTOR_COPY}`;

  return (
    <div
      className="fixed left-4 right-4 z-[55] pointer-events-none max-w-lg mx-auto"
      style={{ bottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))' }}
      role="presentation"
    >
      <div className="pointer-events-auto">
        <TutorOverlay
          visible
          title="Caça-Preço"
          text={text}
          position="bottom"
          mood="happy"
          onContinue={handleClose}
          continueLabel="Continuar →"
          mascotWidth={80}
        />
      </div>
    </div>
  );
}

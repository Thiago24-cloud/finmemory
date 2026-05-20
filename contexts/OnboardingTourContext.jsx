'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { useUserRole } from './UserRoleContext';
import { getFeatureTourSteps } from '../lib/onboarding/featureTourSteps';

/**
 * Contexto leve do UX Tutorial — expõe passos por tipo de conta e helpers de persistência.
 * UI global: `OnboardingGuideGate` + `GuidedOnboarding` (rotas em guidedOnboardingRoutes.js).
 */
const OnboardingTourContext = createContext({
  isRetailer: false,
  isConsumer: true,
  roleLoading: true,
  steps: [],
  persistTourComplete: async () => {},
});

export function OnboardingTourProvider({ children }) {
  const { isRetailer, isConsumer, loading: roleLoading } = useUserRole();

  const steps = useMemo(
    () => getFeatureTourSteps(isRetailer),
    [isRetailer]
  );

  const persistTourComplete = useCallback(async () => {
    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: 'home_intro', value: true }),
      });
    } catch {
      /* rede */
    }
  }, []);

  const value = useMemo(
    () => ({
      isRetailer,
      isConsumer,
      roleLoading,
      steps,
      persistTourComplete,
    }),
    [isRetailer, isConsumer, roleLoading, steps, persistTourComplete]
  );

  return (
    <OnboardingTourContext.Provider value={value}>{children}</OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour() {
  return useContext(OnboardingTourContext);
}

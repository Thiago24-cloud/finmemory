'use client';

import { useCallback, useEffect, useState } from 'react';
import { SpotlightOnboarding } from './SpotlightOnboarding';
import { DASHBOARD_SPOTLIGHT_STEPS } from '../../lib/onboarding/dashboardSpotlightSteps';
import { setDashboardOnboardingDoneLocal } from '../../lib/dashboardOnboardingStorage';

/**
 * Tutorial guiado na primeira visita ao dashboard (spotlight + ação obrigatória).
 */
export function DashboardSpotlightTour({ userId, onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = DASHBOARD_SPOTLIGHT_STEPS[stepIndex];
  const isLast = stepIndex >= DASHBOARD_SPOTLIGHT_STEPS.length - 1;

  useEffect(() => {
    if (!step?.targetId) return;
    const el = document.querySelector(`[data-tour-id="${step.targetId}"]`);
    if (!el && step.advance === 'next_button' && !isLast) {
      setStepIndex((i) => i + 1);
    }
  }, [step, stepIndex, isLast]);

  const finish = useCallback(async () => {
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
    if (userId) setDashboardOnboardingDoneLocal(userId);
    onComplete?.();
  }, [onComplete, userId]);

  const handleNext = useCallback(() => {
    if (step?.finishOnAdvance || isLast) {
      finish();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, DASHBOARD_SPOTLIGHT_STEPS.length - 1));
  }, [finish, isLast, step?.finishOnAdvance]);

  if (!step) return null;

  return (
    <SpotlightOnboarding
      active
      targetId={step.targetId}
      stepIndex={stepIndex}
      stepCount={DASHBOARD_SPOTLIGHT_STEPS.length}
      title={step.title}
      body={step.body}
      advance={step.advance}
      placement={step.placement}
      mood={step.mood || 'neutral'}
      blockNavigation={Boolean(step.blockNavigation)}
      onNext={handleNext}
      onSkip={finish}
    />
  );
}

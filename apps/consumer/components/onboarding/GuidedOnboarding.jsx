'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { OnboardingFocusOverlay } from './OnboardingFocusOverlay';
import { OnboardingPremiumModal } from './OnboardingPremiumModal';
import { setDashboardOnboardingDoneLocal } from '../../lib/dashboardOnboardingStorage';

function queryTarget(targetId) {
  if (!targetId || typeof document === 'undefined') return null;
  return document.querySelector(`[data-tour-id="${targetId}"]`);
}

/**
 * UX Tutorial global: overlay + mãozinha → clique → modal (com mascote opcional).
 *
 * @param {{
 *   userId?: string | null,
 *   steps: Array<import('../../lib/onboarding/coachConsumerSteps').CoachStep>,
 *   mode?: 'intro' | 'coach',
 *   onComplete?: () => void,
 * }} props
 */
export function GuidedOnboarding({ userId, steps, mode = 'intro', onComplete }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  useEffect(() => {
    setStepIndex(0);
    setModalOpen(false);
  }, [steps]);

  useEffect(() => {
    if (!step?.targetId) return;
    const el = queryTarget(step.targetId);
    if (!el && stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    }
  }, [step, stepIndex, steps.length]);

  const postCoachAction = useCallback(
    async (action) => {
      if (!step?.id) return null;
      try {
        const res = await fetch('/api/user/coach-journey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action,
            stepId: step.id,
            mode,
          }),
        });
        return res.ok ? res.json() : null;
      } catch {
        return null;
      }
    },
    [mode, step?.id]
  );

  const maybeMarkIntroDoneLocal = useCallback(
    (json) => {
      if (json?.home_intro_complete && userId) {
        setDashboardOnboardingDoneLocal(userId);
      }
    },
    [userId]
  );

  const persistStep = useCallback(async () => {
    const json = await postCoachAction('complete_step');
    maybeMarkIntroDoneLocal(json);
  }, [maybeMarkIntroDoneLocal, postCoachAction]);

  const finish = useCallback(async () => {
    const json = await postCoachAction('dismiss');
    maybeMarkIntroDoneLocal(json);
    setModalOpen(false);
    onComplete?.();
  }, [maybeMarkIntroDoneLocal, onComplete, postCoachAction]);

  const handleTargetActivate = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleTargetMissing = useCallback(() => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    void finish();
  }, [finish, stepIndex, steps.length]);

  const handleModalNext = useCallback(() => {
    setModalOpen(false);

    const advance = async () => {
      await persistStep();
    };

    if (isLast) {
      if (step?.navigateOnFinish) {
        const el = queryTarget(step.targetId);
        const href = el?.getAttribute?.('href');
        void advance().then(() => {
          onComplete?.();
          if (href && href.startsWith('/')) router.push(href);
        });
        return;
      }
      void advance().then(() => onComplete?.());
      return;
    }

    void advance();
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [isLast, onComplete, persistStep, router, step, steps.length, userId]);

  if (!step) return null;

  return (
    <>
      <OnboardingFocusOverlay
        active={!modalOpen}
        targetId={step.targetId}
        handPlacement={step.handPlacement || 'bottom'}
        onTargetActivate={handleTargetActivate}
        onTargetMissing={handleTargetMissing}
      />
      <OnboardingPremiumModal
        open={modalOpen}
        title={step.modalTitle}
        body={step.modalBody}
        showMascot={false}
        coachMode={mode === 'coach'}
        stepIndex={stepIndex}
        stepCount={steps.length}
        isLast={isLast}
        onNext={handleModalNext}
        onSkip={finish}
      />
    </>
  );
}

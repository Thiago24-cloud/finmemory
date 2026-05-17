'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { AccountTypeSelectionModal } from './AccountTypeSelectionModal';
import { useUserRole } from '../../contexts/UserRoleContext';

/**
 * Modal de perfil Consumidor vs Varejista — após onboarding de nome (ProfileFirstLoginGate).
 */
export function AccountTypeGate({ children }) {
  const { status } = useSession();
  const { needsSelection, loading, setUserRole } = useUserRole();
  const [profileChecked, setProfileChecked] = useState(false);
  const [profileNeedsOnboarding, setProfileNeedsOnboarding] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated') {
      setProfileChecked(true);
      setProfileNeedsOnboarding(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/profile-first-login');
        const data = await res.json();
        if (cancelled) return;
        setProfileNeedsOnboarding(Boolean(data.needsOnboarding));
      } catch {
        if (!cancelled) setProfileNeedsOnboarding(false);
      } finally {
        if (!cancelled) setProfileChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const onComplete = useCallback(
    async (role) => {
      await setUserRole(role);
    },
    [setUserRole]
  );

  const showModal =
    status === 'authenticated' &&
    profileChecked &&
    !profileNeedsOnboarding &&
    !loading &&
    needsSelection;

  return (
    <>
      {children}
      <AccountTypeSelectionModal open={showModal} onComplete={onComplete} />
    </>
  );
}

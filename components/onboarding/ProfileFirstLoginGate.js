'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ProfileFirstLoginModal } from './ProfileFirstLoginModal';

/**
 * Abre o questionário de primeiro login uma vez (quando o servidor indica needsOnboarding).
 */
export function ProfileFirstLoginGate({ children }) {
  const { data: session, status, update } = useSession();
  const [checked, setChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [initialName, setInitialName] = useState('');
  const [initialAvatarUrl, setInitialAvatarUrl] = useState(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.supabaseId) {
      setChecked(true);
      setNeedsOnboarding(false);
      setInitialName('');
      setInitialAvatarUrl(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/profile-first-login');
        const data = await res.json();
        if (cancelled) return;
        setNeedsOnboarding(Boolean(data.needsOnboarding));
        setInitialName(typeof data.displayName === 'string' ? data.displayName : '');
        setInitialAvatarUrl(data.avatarUrl || null);
      } catch {
        if (!cancelled) setNeedsOnboarding(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.supabaseId]);

  const onComplete = useCallback(
    async ({ displayName, avatarUrl }) => {
      try {
        await update({
          name: displayName,
          image: avatarUrl || null,
        });
      } catch (e) {
        console.warn('[ProfileFirstLoginGate] session update:', e);
      }
      setNeedsOnboarding(false);
    },
    [update]
  );

  return (
    <>
      {children}
      {checked && needsOnboarding && (
        <ProfileFirstLoginModal
          open
          initialName={initialName}
          initialAvatarUrl={initialAvatarUrl}
          onComplete={onComplete}
        />
      )}
    </>
  );
}

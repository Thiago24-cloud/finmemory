'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { RecoveryIdentifierModal } from './RecoveryIdentifierModal';

/**
 * Depois do nome/foto (`ProfileFirstLoginGate`), obriga pelo menos celular OU CPF.
 */
export function RecoveryIdentifierGate({ children }) {
  const { data: session, status } = useSession();
  const [checked, setChecked] = useState(false);
  const [needsRecovery, setNeedsRecovery] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.supabaseId) {
      setChecked(true);
      setNeedsRecovery(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/recovery-identifiers');
        const data = await res.json();
        if (cancelled) return;
        setNeedsRecovery(Boolean(data.needsRecovery));
      } catch {
        if (!cancelled) setNeedsRecovery(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.supabaseId]);

  const onDone = useCallback(() => {
    setNeedsRecovery(false);
  }, []);

  return (
    <>
      {children}
      {checked && needsRecovery ? <RecoveryIdentifierModal open onComplete={onDone} /> : null}
    </>
  );
}

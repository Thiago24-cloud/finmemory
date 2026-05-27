'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSession } from 'next-auth/react';

const emptyState = {
  missions: [],
  secondsUntilReset: 0,
  today: null,
  loading: false,
  error: null,
};

const MissionsTodayContext = createContext(null);

/**
 * Um único GET /api/missions/today por sessão autenticada — partilhado entre BottomNav, dashboard e /missoes.
 */
export function MissionsTodayProvider({ children }) {
  const { data: session, status } = useSession();
  const [state, setState] = useState(emptyState);

  const refresh = useCallback(
    async (opts = {}) => {
      const silent = opts.silent === true;
      if (status !== 'authenticated' || !session?.user) return;
      if (!silent) setState((s) => ({ ...s, loading: true }));
      try {
        const r = await fetch('/api/missions/today');
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        setState({
          missions: Array.isArray(d.missions) ? d.missions : [],
          secondsUntilReset: Number(d.seconds_until_reset) || 0,
          today: d.today ?? null,
          loading: false,
          error: null,
        });
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e : new Error('missions fetch'),
        }));
      }
    },
    [status, session?.user]
  );

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'authenticated' || !session?.user) {
      setState(emptyState);
      return;
    }
    refresh({ silent: false });
  }, [status, session?.user, refresh]);

  const value = useMemo(
    () => ({
      missions: state.missions,
      secondsUntilReset: state.secondsUntilReset,
      today: state.today,
      loading: state.loading,
      error: state.error,
      refresh,
      /** Pelo menos uma missão ainda não concluída (para bolha na BottomNav) */
      hasIncompleteMissions: (state.missions || []).some((m) => !m.completed),
    }),
    [state, refresh]
  );

  return (
    <MissionsTodayContext.Provider value={value}>{children}</MissionsTodayContext.Provider>
  );
}

export function useMissionsToday() {
  const ctx = useContext(MissionsTodayContext);
  if (!ctx) {
    throw new Error('useMissionsToday must be used within MissionsTodayProvider');
  }
  return ctx;
}

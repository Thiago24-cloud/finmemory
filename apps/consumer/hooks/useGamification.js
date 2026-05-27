import { useState, useEffect, useCallback } from 'react';

/**
 * Busca XP, nível e streak do usuário logado.
 * Provê função `bumpStreak()` para registrar atividade do dia.
 */
export function useGamification() {
  const [data, setData] = useState({ xp_points: 0, level: 1, contributions_count: 0, streak_current: 0, streak_max: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/map/gamification-me').then((r) => r.ok ? r.json() : {}),
      fetch('/api/gamification/streak').then((r) => r.ok ? r.json() : {}),
    ])
      .then(([xpData, streakData]) => {
        if (cancelled) return;
        setData({
          xp_points: xpData.xp_points || 0,
          level: xpData.level || 1,
          contributions_count: xpData.contributions_count || 0,
          streak_current: streakData.streak_current || 0,
          streak_max: streakData.streak_max || 0,
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const bumpStreak = useCallback(async () => {
    try {
      const r = await fetch('/api/gamification/streak', { method: 'POST' });
      if (!r.ok) return;
      const d = await r.json();
      if (d.updated) {
        setData((prev) => ({ ...prev, streak_current: d.streak_current, streak_max: d.streak_max }));
      }
    } catch (_) {}
  }, []);

  return { ...data, loading, bumpStreak };
}

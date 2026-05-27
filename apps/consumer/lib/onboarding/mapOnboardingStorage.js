/** Fallback local: mapa já visto neste browser (quando API/JSONB indisponível). */
export function mapOnboardingStorageKey(userId) {
  if (!userId || typeof userId !== 'string') return null;
  return `finmemory_map_onboarding_v1_${userId}`;
}

export function isMapOnboardingDoneLocal(userId) {
  if (typeof window === 'undefined' || !userId) return false;
  const k = mapOnboardingStorageKey(userId);
  return k ? window.localStorage.getItem(k) === '1' : false;
}

export function setMapOnboardingDoneLocal(userId) {
  if (typeof window === 'undefined' || !userId) return;
  const k = mapOnboardingStorageKey(userId);
  if (k) window.localStorage.setItem(k, '1');
}

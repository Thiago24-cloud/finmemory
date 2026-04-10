/** Chave localStorage: uma vez por utilizador neste browser (fallback se API/Supabase falhar). */
export function dashboardOnboardingStorageKey(userId) {
  if (!userId || typeof userId !== 'string') return null;
  return `finmemory_dash_onboarding_v1_${userId}`;
}

export function isDashboardOnboardingDoneLocal(userId) {
  if (typeof window === 'undefined' || !userId) return true;
  const k = dashboardOnboardingStorageKey(userId);
  return k ? window.localStorage.getItem(k) === '1' : true;
}

export function setDashboardOnboardingDoneLocal(userId) {
  if (typeof window === 'undefined' || !userId) return;
  const k = dashboardOnboardingStorageKey(userId);
  if (k) window.localStorage.setItem(k, '1');
}

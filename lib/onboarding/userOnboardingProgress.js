/** Chaves permitidas em `users.onboarding_progress` (JSONB). */
export const ONBOARDING_PROGRESS_KEYS = [
  'home_intro',
  'first_receipt_scanned',
  'map_opened',
  'stock_replenishment_seen',
];

export const DEFAULT_ONBOARDING_PROGRESS = Object.freeze({
  home_intro: false,
  first_receipt_scanned: false,
  map_opened: false,
  stock_replenishment_seen: false,
});

const KEY_SET = new Set(ONBOARDING_PROGRESS_KEYS);

export function isValidOnboardingKey(key) {
  return typeof key === 'string' && KEY_SET.has(key);
}

/** Normaliza JSONB do Supabase (ou legado) para objeto completo. */
export function normalizeOnboardingProgress(raw) {
  const base = { ...DEFAULT_ONBOARDING_PROGRESS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  for (const k of ONBOARDING_PROGRESS_KEYS) {
    if (typeof raw[k] === 'boolean') base[k] = raw[k];
  }
  return base;
}

/** Tour do dashboard = passo `home_intro` concluído. */
export function hasSeenDashboardOnboarding(progress) {
  return Boolean(normalizeOnboardingProgress(progress).home_intro);
}

/** Primeira visita ao Caça-Preço / mapa. */
export function hasOpenedMapOnboarding(progress) {
  return Boolean(normalizeOnboardingProgress(progress).map_opened);
}

/**
 * Rotas onde o UX Tutorial (mãozinha + modal) pode montar.
 * Fonte: .context/onboarding-features.md — alvos no dashboard (/dashboard = Gastos).
 */

/** @type {readonly string[]} */
export const GUIDED_ONBOARDING_ROUTES = ['/dashboard'];

/**
 * @param {string | undefined} pathname
 * @returns {boolean}
 */
export function isGuidedOnboardingRoute(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  return GUIDED_ONBOARDING_ROUTES.includes(pathname);
}

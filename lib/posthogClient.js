/**
 * PostHog no browser (posthog-js). Usado no fluxo de auth/cadastro e em _app.
 * NEXT_PUBLIC_POSTHOG_KEY tem de existir no build (Capacitor inclui o bundle Next).
 */
import posthog from 'posthog-js';

export function hasPosthogProjectKey() {
  return Boolean(
    typeof process !== 'undefined' && String(process.env.NEXT_PUBLIC_POSTHOG_KEY || '').trim()
  );
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [props]
 */
export function capturePosthog(event, props = {}) {
  if (typeof window === 'undefined' || !hasPosthogProjectKey()) return;
  try {
    posthog.capture(event, props);
  } catch (e) {
    console.warn('[posthog] capture', event, e);
  }
}

/**
 * @param {string} distinctId
 * @param {Record<string, unknown>} [props]
 */
export function identifyPosthog(distinctId, props = {}) {
  if (typeof window === 'undefined' || !hasPosthogProjectKey() || !distinctId) return;
  try {
    posthog.identify(String(distinctId), props);
  } catch (e) {
    console.warn('[posthog] identify', e);
  }
}

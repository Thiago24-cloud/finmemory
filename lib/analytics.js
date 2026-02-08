/**
 * Analytics (GA4) - helpers para gtag.
 * Depende do GoogleAnalytics (@next/third-parties) carregado no _app.
 */

export function setUserId(userId) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'G-K783HNBGE8', { user_id: userId });
  }
}

export function setUserProperties(properties) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('set', 'user_properties', properties);
  }
}

export function trackEvent(name, params = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, params);
  }
}

import { useEffect } from 'react';

/**
 * Regista o service worker (PWA). Query `?v=` muda a cada deploy (NEXT_PUBLIC_BUILD_ID)
 * para o browser descarregar o novo script e ativar limpeza de caches no activate.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const { protocol, hostname } = window.location;
    const secure = protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
    if (!secure) return;

    const buildId =
      typeof process.env.NEXT_PUBLIC_BUILD_ID === 'string' && process.env.NEXT_PUBLIC_BUILD_ID.trim()
        ? process.env.NEXT_PUBLIC_BUILD_ID.trim()
        : 'dev';
    const swUrl = `/sw.js?v=${encodeURIComponent(buildId)}`;

    let cancelled = false;
    const register = async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration('/');
        if (existing?.active?.scriptURL) {
          try {
            const oldUrl = new URL(existing.active.scriptURL);
            const oldV = oldUrl.searchParams.get('v');
            if (oldV !== buildId) {
              await existing.unregister();
            }
          } catch (_) {
            await existing.unregister();
          }
        }
        const reg = await navigator.serviceWorker.register(swUrl, { scope: '/' });
        if (cancelled) return;
        await reg.update().catch(() => {});
      } catch (_) {
        /* silencioso: preview / bloqueios de terceiros */
      }
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

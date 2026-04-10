import { useCallback, useEffect, useRef, useState } from 'react';
import { detectInstallContext } from '../lib/pwa-install';
import { trackEvent } from '../lib/analytics';

const LS_DISMISSED = 'fm_install_dismissed';
const LS_DONE = 'fm_install_done';
const LS_VISIT = 'fm_visit_count';
const SS_COUNTED = 'fm_visit_counted_session';

/**
 * @typedef {import('../lib/pwa-install').InstallContext} InstallContext
 */

/**
 * @returns {{
 *   context: InstallContext | null;
 *   showAssistant: boolean;
 *   setShowAssistant: (v: boolean) => void;
 *   triggerNativePrompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
 *   dismiss: (permanent?: boolean) => void;
 *   visitCount: number;
 * }}
 */
export function usePWAInstall() {
  const [context, setContext] = useState(
    /** @type {InstallContext | null} */ (null)
  );
  const [showAssistant, setShowAssistant] = useState(false);
  const [visitCount, setVisitCount] = useState(0);
  const deferredPrompt = useRef(/** @type {any} */ (null));

  const dismiss = useCallback((permanent = false) => {
    if (permanent) {
      try {
        localStorage.setItem(LS_DISMISSED, '1');
      } catch (_) {}
      trackEvent('pwa_install_dismissed_permanent', {
        platform: context?.platform || 'unknown',
      });
    }
    setShowAssistant(false);
  }, [context?.platform]);

  const triggerNativePrompt = useCallback(async () => {
    const ev = deferredPrompt.current;
    if (!ev || typeof ev.prompt !== 'function') return 'unavailable';
    try {
      ev.prompt();
      const choice = await ev.userChoice;
      deferredPrompt.current = null;
      setContext((prev) =>
        prev ? { ...prev, canUseNativePrompt: false } : prev
      );
      if (choice?.outcome === 'accepted') {
        try {
          localStorage.setItem(LS_DONE, '1');
        } catch (_) {}
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('fm-pwa-install-done'));
        }
        trackEvent('pwa_install_accepted');
        setShowAssistant(false);
        return 'accepted';
      }
      trackEvent('pwa_install_rejected');
      return 'dismissed';
    } catch (_) {
      deferredPrompt.current = null;
      return 'unavailable';
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const ctx = detectInstallContext();
    setContext(ctx);

    if (ctx.isStandalone) return undefined;

    let visits = 0;
    try {
      if (!sessionStorage.getItem(SS_COUNTED)) {
        sessionStorage.setItem(SS_COUNTED, '1');
        visits = parseInt(localStorage.getItem(LS_VISIT) || '0', 10) + 1;
        localStorage.setItem(LS_VISIT, String(visits));
      } else {
        visits = parseInt(localStorage.getItem(LS_VISIT) || '0', 10);
      }
    } catch (_) {
      visits = 1;
    }
    setVisitCount(visits);

    let dismissed = false;
    let installed = false;
    try {
      dismissed = localStorage.getItem(LS_DISMISSED) === '1';
      installed = localStorage.getItem(LS_DONE) === '1';
    } catch (_) {}

    let delayedShowTimer = null;

    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = /** @type {any} */ (e);
      setContext((prev) => {
        const base = prev || detectInstallContext();
        return { ...base, canUseNativePrompt: true };
      });
      if (dismissed || installed || ctx.platform === 'desktop') return;
      if (delayedShowTimer != null) {
        window.clearTimeout(delayedShowTimer);
        delayedShowTimer = null;
      }
      delayedShowTimer = window.setTimeout(() => setShowAssistant(true), 1600);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (dismissed || installed || ctx.platform === 'desktop') {
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }

    const delayMs = visits >= 2 ? 5000 : 35000;
    delayedShowTimer = window.setTimeout(() => setShowAssistant(true), delayMs);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (delayedShowTimer != null) window.clearTimeout(delayedShowTimer);
    };
  }, []);

  return {
    context,
    showAssistant,
    setShowAssistant,
    triggerNativePrompt,
    dismiss,
    visitCount,
  };
}

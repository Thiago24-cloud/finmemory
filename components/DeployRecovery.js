import { useEffect } from 'react';
import Router from 'next/router';

/**
 * Após novo deploy no Cloud Run, o browser pode pedir chunks ou
 * /_next/data/{buildIdAntigo}/....json → 404. Recarrega a página para
 * alinhar ao build atual.
 */
export function DeployRecovery() {
  useEffect(() => {
    const reloadOnceChunk = () => {
      if (typeof window === 'undefined') return;
      const k = 'finmemory_chunk_reload_ts';
      const now = Date.now();
      const last = parseInt(window.sessionStorage.getItem(k) || '0', 10);
      if (now - last < 8000) return;
      window.sessionStorage.setItem(k, String(now));
      window.location.reload();
    };

    const revisionKey = 'finmemory_k_revision';

    const syncDeployRevision = async () => {
      if (typeof window === 'undefined') return;
      try {
        const r = await fetch('/api/health', { cache: 'no-store', credentials: 'same-origin' });
        if (!r.ok) return;
        const j = await r.json();
        const rev = j?.deploy?.revision;
        if (!rev || typeof rev !== 'string') return;
        const prev = window.sessionStorage.getItem(revisionKey);
        window.sessionStorage.setItem(revisionKey, rev);
        if (prev && prev !== rev) {
          window.location.reload();
        }
      } catch (_) {
        /* rede / offline */
      }
    };

    /** `/_next/data` 404 após deploy: patch em `pages/_document.js` (throttle separado dos chunks). */

    const onWindowError = (event) => {
      const msg = String(event?.message || '');
      if (
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Failed to fetch dynamically imported module')
      ) {
        if (typeof window.__finmemoryReloadOnChunkError === 'function') {
          window.__finmemoryReloadOnChunkError();
        } else {
          reloadOnceChunk();
        }
      }
    };

    const onRejection = (event) => {
      const r = event?.reason;
      const s = String(r?.message || r || '');
      if (
        s.includes('Loading chunk') ||
        s.includes('ChunkLoadError') ||
        s.includes('Failed to fetch dynamically imported module')
      ) {
        if (typeof window.__finmemoryReloadOnChunkError === 'function') {
          window.__finmemoryReloadOnChunkError();
        } else {
          reloadOnceChunk();
        }
      }
    };

    const onRouteErr = (err) => {
      if (err?.cancelled) return;
      const name = err?.name || '';
      const msg = String(err?.message || '');
      if (name === 'ChunkLoadError' || msg.includes('Loading CSS chunk')) {
        if (typeof window.__finmemoryReloadOnChunkError === 'function') {
          window.__finmemoryReloadOnChunkError();
        } else {
          reloadOnceChunk();
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncDeployRevision();
    };

    const onPageShow = (e) => {
      if (e.persisted) syncDeployRevision();
    };

    void syncDeployRevision();
    const revisionInterval = window.setInterval(syncDeployRevision, 90_000);

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    Router.events.on('routeChangeError', onRouteErr);

    return () => {
      window.clearInterval(revisionInterval);
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
      Router.events.off('routeChangeError', onRouteErr);
    };
  }, []);

  return null;
}

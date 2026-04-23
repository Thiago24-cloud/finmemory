'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, animate } from 'framer-motion';

/** px — arrasto mínimo para considerar mudança de detent */
const COMMIT_DRAG_PX = 56;
/** Toque curto no handle / chrome sem arrasto */
const TAP_MAX_PX = 14;
/** Resistência ao arrastar para baixo (colapsar) */
const PULL_DOWN_RUBBER = 0.62;
const PULL_DOWN_MAX_PX = 200;
/** Resistência ao “puxar para cima” além do full (Nubank-style) */
const PULL_UP_RUBBER = 0.28;
const PULL_UP_MAX_PX = 48;
/**
 * z-index: overlay 1003, folha 1004 — acima dos pins Leaflet (~600)
 * e da barra de busca do mapa (z-[1001]); abaixo de sidebars fixas (1005+).
 */
const Z_OVERLAY = 1003;
const Z_SHEET = 1004;

/**
 * Bottom sheet do mapa de preços (mobile): detents half (~35% dvh) | full (~95% dvh).
 * closed = painel desmontado pelo pai (onSnapChange('closed')).
 *
 * Gestos:
 * - Arrasto a partir de [data-sheet-handle] ou [data-sheet-sticky] (fora de inputs) move a folha.
 * - Na área rolável [data-sheet-scroll]: se scrollTop === 0 e o gesto é para baixo, move a folha
 *   em vez de rolar a lista (nested scroll corrigido).
 *
 * @param {object} p
 * @param {'closed'|'half'|'full'} p.snap
 * @param {(next: 'closed'|'half'|'full') => void} p.onSnapChange
 * @param {boolean} p.wazeUi — ajusta cores de texto no chrome (mantém fundo premium #0f0f0f)
 * @param {React.ReactNode} p.children — corpo (só a grelha / conteúdo rolável)
 * @param {number} [p.halfDvh]
 * @param {number} [p.fullDvh]
 * @param {React.ReactNode} [p.stickyChrome] — fixo sob o handle (nome + busca etc.)
 * @param {(m: { snap: string; bottomInsetPx: number }) => void} [p.onVisualMetrics]
 */
export default function MapMobileBottomSheet({
  snap,
  onSnapChange,
  wazeUi,
  children,
  halfDvh = 35,
  fullDvh = 95,
  stickyChrome = null,
  onVisualMetrics,
}) {
  const reduceMotion = useReducedMotion();
  const [vh, setVh] = useState(640);

  const scrollRef = useRef(null);
  const suppressChromeClickUntil = useRef(0);

  const snapRef = useRef(snap);
  snapRef.current = snap;

  /** Arrasto ativo: 'handle' | 'scroll_pull' | null */
  const dragKindRef = useRef(null);
  const dragStartYRef = useRef(0);
  const dragStartScrollTopRef = useRef(0);
  const activePointerIdRef = useRef(null);

  /** Offset visual em px: positivo = folha desce (colapsa); negativo = folha “estica” além do full */
  const dragOffsetMv = useMotionValue(0);

  const onVisualMetricsRef = useRef(onVisualMetrics);
  onVisualMetricsRef.current = onVisualMetrics;

  useEffect(() => {
    const upd = () => setVh(window.innerHeight || 640);
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  const hHalfPx = useMemo(() => Math.round((halfDvh / 100) * vh), [halfDvh, vh]);
  const hFullPx = useMemo(() => Math.round((fullDvh / 100) * vh), [fullDvh, vh]);

  const targetHeightPx = snap === 'full' ? hFullPx : hHalfPx;

  const springTransition = useMemo(
    () =>
      reduceMotion
        ? { duration: 0.2 }
        : { type: 'spring', stiffness: 480, damping: 40, mass: 0.88 },
    [reduceMotion]
  );

  const pullOffsetRef = useRef(0);
  pullOffsetRef.current = dragOffsetMv.get();

  useEffect(() => {
    const unsub = dragOffsetMv.on('change', (v) => {
      pullOffsetRef.current = v;
    });
    return () => unsub();
  }, [dragOffsetMv]);

  const reportMetrics = useCallback(() => {
    const fn = onVisualMetricsRef.current;
    if (!fn) return;
    const base = snapRef.current === 'full' ? hFullPx : hHalfPx;
    const extra = pullOffsetRef.current;
    const bottomInsetPx = Math.max(0, Math.round(base - Math.max(0, extra)));
    fn({ snap: snapRef.current, bottomInsetPx });
  }, [hFullPx, hHalfPx]);

  useEffect(() => {
    dragOffsetMv.set(0);
  }, [snap, dragOffsetMv]);

  useEffect(() => {
    reportMetrics();
  }, [snap, hFullPx, hHalfPx, reportMetrics]);

  useEffect(() => {
    if (!onVisualMetricsRef.current) return undefined;
    const onResize = () => reportMetrics();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [reportMetrics]);

  const settleDragOffset = useCallback(() => {
    if (reduceMotion) {
      dragOffsetMv.set(0);
    } else {
      animate(dragOffsetMv, 0, { type: 'spring', stiffness: 520, damping: 42, mass: 0.85 });
    }
  }, [dragOffsetMv, reduceMotion]);

  const resolveEndFromDragOffset = useCallback(() => {
    const off = Math.max(0, pullOffsetRef.current);
    const s = snapRef.current;
    if (off < 24) return;
    if (s === 'full') {
      if (off > 120) onSnapChange('closed');
      else if (off > COMMIT_DRAG_PX) onSnapChange('half');
      return;
    }
    if (s === 'half' && off > COMMIT_DRAG_PX) {
      onSnapChange('closed');
    }
  }, [onSnapChange]);

  const applyTapToggle = useCallback(() => {
    const s = snapRef.current;
    if (s === 'half') onSnapChange('full');
    else onSnapChange('half');
  }, [onSnapChange]);

  const onChromeTapOrToggle = useCallback(
    (e) => {
      if (Date.now() < suppressChromeClickUntil.current) return;
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (el.closest('button, a, input, textarea, select, [data-sheet-no-tap-expand]')) return;
      applyTapToggle();
    },
    [applyTapToggle]
  );

  const isInteractiveTarget = useCallback((target) => {
    if (!(target instanceof Element)) return true;
    return Boolean(
      target.closest(
        'button, a, input, textarea, select, [data-sheet-no-tap-expand], [data-sheet-pan-x]'
      )
    );
  }, []);

  /** ----- Handle / sticky: pointer (arrasto sempre move folha) ----- */
  const onHandlePointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      if (isInteractiveTarget(e.target)) return;
      dragKindRef.current = 'handle';
      dragOffsetMv.set(0);
      dragStartYRef.current = e.clientY;
      activePointerIdRef.current = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    },
    [dragOffsetMv, isInteractiveTarget]
  );

  const onHandlePointerMove = useCallback(
    (e) => {
      if (dragKindRef.current !== 'handle') return;
      if (e.pointerId !== activePointerIdRef.current) return;
      const dy = e.clientY - dragStartYRef.current;
      const s = snapRef.current;

      if (dy > 0) {
        const rubber = Math.min(PULL_DOWN_MAX_PX, dy * PULL_DOWN_RUBBER);
        dragOffsetMv.set(rubber);
      } else if (s === 'full' && dy < 0) {
        const up = Math.max(-PULL_UP_MAX_PX, dy * PULL_UP_RUBBER);
        dragOffsetMv.set(up);
      } else if (s === 'half' && dy < 0) {
        const up = Math.max(-PULL_UP_MAX_PX, dy * PULL_UP_RUBBER);
        dragOffsetMv.set(up);
      } else {
        dragOffsetMv.set(0);
      }
      reportMetrics();
    },
    [dragOffsetMv, reportMetrics]
  );

  const endHandleDrag = useCallback(
    (e) => {
      if (dragKindRef.current !== 'handle') return;
      if (e.pointerId !== activePointerIdRef.current) return;
      dragKindRef.current = null;
      activePointerIdRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }

      const dy = e.clientY - dragStartYRef.current;
      if (Math.abs(dy) < TAP_MAX_PX) {
        suppressChromeClickUntil.current = Date.now() + 400;
        applyTapToggle();
        settleDragOffset();
        return;
      }

      if (dy > COMMIT_DRAG_PX) {
        const s = snapRef.current;
        if (s === 'full') {
          if (pullOffsetRef.current > 110) onSnapChange('closed');
          else onSnapChange('half');
        } else if (s === 'half') {
          onSnapChange('closed');
        }
      } else if (dy < -COMMIT_DRAG_PX && snapRef.current === 'half') {
        onSnapChange('full');
      } else {
        resolveEndFromDragOffset();
      }
      settleDragOffset();
    },
    [applyTapToggle, onSnapChange, resolveEndFromDragOffset, settleDragOffset]
  );

  /** ----- Lista: quando scrollTop === 0, arrastar para baixo move a folha ----- */
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;

    const touchPull = { active: false, startY: 0, startScrollTop: 0 };

    const onTouchStart = (e) => {
      if (snapRef.current === 'closed') return;
      if (isInteractiveTarget(e.target)) return;
      touchPull.active = true;
      touchPull.startY = e.touches[0].clientY;
      touchPull.startScrollTop = scrollEl.scrollTop;
    };

    const onTouchMove = (e) => {
      if (!touchPull.active) return;
      const y = e.touches[0].clientY;
      const dy = y - touchPull.startY;
      const st = scrollEl.scrollTop;

      if (touchPull.startScrollTop > 0 || st > 0) {
        if (st > 0) {
          touchPull.startScrollTop = st;
          touchPull.startY = y;
          dragOffsetMv.set(0);
        }
        return;
      }

      if (dy <= 0) return;

      if (e.cancelable) e.preventDefault();
      const rubber = Math.min(PULL_DOWN_MAX_PX, dy * PULL_DOWN_RUBBER);
      dragOffsetMv.set(rubber);
      reportMetrics();
    };

    const onTouchEnd = () => {
      if (!touchPull.active) return;
      touchPull.active = false;
      if (pullOffsetRef.current > 8) {
        resolveEndFromDragOffset();
      }
      settleDragOffset();
    };

    scrollEl.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollEl.addEventListener('touchmove', onTouchMove, { passive: false });
    scrollEl.addEventListener('touchend', onTouchEnd);
    scrollEl.addEventListener('touchcancel', onTouchEnd);
    return () => {
      scrollEl.removeEventListener('touchstart', onTouchStart);
      scrollEl.removeEventListener('touchmove', onTouchMove);
      scrollEl.removeEventListener('touchend', onTouchEnd);
      scrollEl.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [dragOffsetMv, isInteractiveTarget, reportMetrics, resolveEndFromDragOffset, settleDragOffset, snap]);

  /** Overlay: escurece mais no full + um pouco durante arrasto para baixo */
  const overlayBaseHalf = wazeUi ? 0.2 : 0.14;
  const overlayBaseFull = wazeUi ? 0.52 : 0.48;
  const overlayOpacityTarget =
    snap === 'full' ? overlayBaseFull : snap === 'half' ? overlayBaseHalf : 0;

  const sheetSurface =
    'rounded-t-[24px] border-t border-white/[0.08] bg-[#0f0f0f] shadow-[0_-16px_48px_rgba(0,0,0,0.55)]';

  return (
    <>
      <AnimatePresence>
        {(snap === 'half' || snap === 'full') && (
          <motion.button
            key="sheet-overlay"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: overlayOpacityTarget }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22 }}
            className="fixed inset-0 border-0 bg-black p-0"
            style={{ zIndex: Z_OVERLAY }}
            aria-label={snap === 'full' ? 'Recolher painel' : 'Fechar painel'}
            onClick={() => {
              if (snap === 'full') onSnapChange('half');
              else onSnapChange('closed');
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className={`fixed inset-x-0 bottom-0 flex min-h-0 max-h-none flex-col overflow-hidden pb-[max(0px,env(safe-area-inset-bottom))] ${sheetSurface}`}
        style={{
          zIndex: Z_SHEET,
          y: dragOffsetMv,
        }}
        initial={false}
        animate={{
          height: targetHeightPx,
        }}
        transition={{
          height: springTransition,
        }}
      >
        <div
          data-sheet-handle
          role="presentation"
          className="flex shrink-0 cursor-grab active:cursor-grabbing flex-col items-center justify-center gap-2 px-4 pb-2 pt-3.5 select-none touch-none"
          style={{ touchAction: 'none' }}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={endHandleDrag}
          onPointerCancel={endHandleDrag}
        >
          <div className="h-1 w-11 shrink-0 rounded-full bg-[#5c5c5c]" aria-hidden />
          <span className="text-center text-[10px] font-medium leading-tight text-[#737373]">
            {snap === 'half'
              ? 'Arraste para cima para ver ofertas · para baixo para fechar'
              : 'Com a lista no topo, arraste para baixo para recolher'}
          </span>
        </div>

        {stickyChrome ? (
          <div
            data-sheet-sticky
            className="shrink-0 border-b border-white/[0.06] bg-[#0f0f0f]"
            onPointerDown={(e) => {
              if (isInteractiveTarget(e.target)) return;
              onHandlePointerDown(e);
            }}
            onPointerMove={onHandlePointerMove}
            onPointerUp={endHandleDrag}
            onPointerCancel={endHandleDrag}
            onClick={onChromeTapOrToggle}
          >
            {stickyChrome}
          </div>
        ) : null}

        <div
          ref={scrollRef}
          data-sheet-scroll
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain"
          style={{
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>
      </motion.div>
    </>
  );
}

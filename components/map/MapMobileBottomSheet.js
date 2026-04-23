'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const DRAG_THRESHOLD = 44;
const TAP_MAX_DY = 14;
/** A partir deste arrasto (px) em full com lista no topo, fecha direto para half → closed em sequência rápida não: um gesto grande vai para half; segundo gesto… simplificamos: > BIG fecha. */
const DRAG_TO_CLOSE_FROM_FULL = 110;
const PULL_RUBBER = 0.55;
const PULL_MAX = 220;

/**
 * Bottom sheet estilo Google Maps (mobile): detents closed | half | full,
 * scroll aninhado (lista no scrollTop 0 + arrastar para baixo move o painel)
 * e física com spring (framer-motion).
 *
 * @param {object} p
 * @param {'closed'|'half'|'full'} p.snap
 * @param {(next: 'closed'|'half'|'full') => void} p.onSnapChange
 * @param {boolean} p.wazeUi
 * @param {React.ReactNode} p.children
 * @param {number} [p.halfDvh] ~35
 * @param {number} [p.fullDvh] ~95
 * @param {React.ReactNode} [p.stickyChrome] — fixo abaixo do handle (ex.: pills + título)
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
  const pullRef = useRef({ active: false, startY: 0, startScrollTop: 0, mode: null });
  const [pullOffset, setPullOffset] = useState(0);
  const pullOffsetRef = useRef(0);
  pullOffsetRef.current = pullOffset;

  const snapRef = useRef(snap);
  snapRef.current = snap;

  const suppressChromeClickUntil = useRef(0);
  const dragY0 = useRef(null);

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
        : { type: 'spring', stiffness: 520, damping: 42, mass: 0.85 },
    [reduceMotion]
  );

  const onVisualMetricsRef = useRef(onVisualMetrics);
  onVisualMetricsRef.current = onVisualMetrics;

  const reportMetrics = useCallback(() => {
    const fn = onVisualMetricsRef.current;
    if (!fn) return;
    const base = snapRef.current === 'full' ? hFullPx : hHalfPx;
    const bottomInsetPx = Math.max(0, Math.round(base - pullOffsetRef.current));
    fn({ snap: snapRef.current, bottomInsetPx });
  }, [hFullPx, hHalfPx]);

  useEffect(() => {
    setPullOffset(0);
  }, [snap]);

  useEffect(() => {
    reportMetrics();
  }, [snap, hFullPx, hHalfPx, pullOffset, reportMetrics]);

  useEffect(() => {
    if (!onVisualMetricsRef.current) return undefined;
    const onResize = () => reportMetrics();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [reportMetrics]);

  const endPull = useCallback(() => {
    const off = pullOffsetRef.current;
    setPullOffset(0);
    pullRef.current = { active: false, startY: 0, startScrollTop: 0, mode: null };
    const s = snapRef.current;
    if (off < 24) return;
    if (s === 'full') {
      if (off > DRAG_TO_CLOSE_FROM_FULL) onSnapChange('closed');
      else if (off > DRAG_THRESHOLD) onSnapChange('half');
      return;
    }
    if (s === 'half' && off > DRAG_THRESHOLD) {
      onSnapChange('closed');
    }
  }, [onSnapChange]);

  const applySnapFromDrag = useCallback(
    (dy) => {
      const s = snapRef.current;
      if (dy > DRAG_THRESHOLD) {
        if (s === 'full') onSnapChange('half');
        else onSnapChange('closed');
        return;
      }
      if (dy < -DRAG_THRESHOLD) {
        if (s === 'half') onSnapChange('full');
      }
    },
    [onSnapChange]
  );

  const onChromeClick = useCallback(
    (e) => {
      if (Date.now() < suppressChromeClickUntil.current) return;
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (el.closest('button, a, input, textarea, select, [data-sheet-no-tap-expand]')) return;
      const s = snapRef.current;
      if (s === 'half') onSnapChange('full');
      else onSnapChange('half');
    },
    [onSnapChange]
  );

  const onTouchStart = useCallback((e) => {
    dragY0.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (dragY0.current == null) return;
    if (e.cancelable) e.preventDefault();
  }, []);

  const onTouchEnd = useCallback(
    (e) => {
      if (dragY0.current == null) return;
      const y0 = dragY0.current;
      dragY0.current = null;
      const dy = e.changedTouches[0].clientY - y0;
      const s = snapRef.current;

      if (Math.abs(dy) < TAP_MAX_DY) {
        suppressChromeClickUntil.current = Date.now() + 450;
        if (s === 'half') onSnapChange('full');
        else onSnapChange('half');
        return;
      }
      applySnapFromDrag(dy);
    },
    [applySnapFromDrag, onSnapChange]
  );

  const pointerDownY = useRef(null);
  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    pointerDownY.current = e.clientY;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  const onPointerUp = useCallback(
    (e) => {
      if (pointerDownY.current == null) return;
      const y0 = pointerDownY.current;
      pointerDownY.current = null;
      const dy = e.clientY - y0;
      const s = snapRef.current;
      if (Math.abs(dy) < TAP_MAX_DY) {
        suppressChromeClickUntil.current = Date.now() + 450;
        if (s === 'half') onSnapChange('full');
        else onSnapChange('half');
        return;
      }
      applySnapFromDrag(dy);
    },
    [applySnapFromDrag, onSnapChange]
  );

  /** Pull-to-collapse no corpo quando scrollTop === 0 */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    const isChromeTarget = (target) => {
      if (!(target instanceof Element)) return true;
      return Boolean(
        target.closest(
          'button, a, input, textarea, select, [data-sheet-no-tap-expand], [data-sheet-pan-x]'
        )
      );
    };

    const onTouchStartBody = (e) => {
      if (snapRef.current === 'closed') return;
      if (isChromeTarget(e.target)) return;
      pullRef.current = {
        active: true,
        startY: e.touches[0].clientY,
        startScrollTop: el.scrollTop,
        mode: null,
      };
    };

    const onTouchMoveBody = (e) => {
      const pr = pullRef.current;
      if (!pr.active) return;
      const y = e.touches[0].clientY;
      const dy = y - pr.startY;
      if (pr.startScrollTop > 0 || el.scrollTop > 0) {
        if (dy < 0) pr.mode = 'scroll';
        if (el.scrollTop > 0) {
          pr.startScrollTop = el.scrollTop;
          pr.startY = y;
          setPullOffset(0);
        }
        return;
      }
      if (dy <= 0) return;
      if (e.cancelable) e.preventDefault();
      pr.mode = 'pull';
      const rubber = Math.min(PULL_MAX, dy * PULL_RUBBER);
      setPullOffset(rubber);
    };

    const onTouchEndBody = () => {
      if (!pullRef.current.active) return;
      pullRef.current.active = false;
      if (pullRef.current.mode === 'pull' || pullOffsetRef.current > 8) {
        endPull();
      } else {
        setPullOffset(0);
      }
    };

    el.addEventListener('touchstart', onTouchStartBody, { passive: true });
    el.addEventListener('touchmove', onTouchMoveBody, { passive: false });
    el.addEventListener('touchend', onTouchEndBody);
    el.addEventListener('touchcancel', onTouchEndBody);
    return () => {
      el.removeEventListener('touchstart', onTouchStartBody);
      el.removeEventListener('touchmove', onTouchMoveBody);
      el.removeEventListener('touchend', onTouchEndBody);
      el.removeEventListener('touchcancel', onTouchEndBody);
    };
  }, [endPull, snap]);

  const overlayOpacity = snap === 'full' ? (wazeUi ? 0.52 : 0.38) : wazeUi ? 0.22 : 0.16;

  const sheetBg = wazeUi
    ? 'rounded-t-[24px] border-t border-[#2a2d3a] bg-[#0f0f0f] shadow-[0_-12px_36px_rgba(0,0,0,0.45)]'
    : 'rounded-t-[24px] border-t border-gray-200 bg-white shadow-[0_-12px_36px_rgba(0,0,0,0.14)]';

  return (
    <>
      <AnimatePresence>
        {(snap === 'half' || snap === 'full') && (
          <motion.button
            key="sheet-overlay"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: overlayOpacity }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22 }}
            className="fixed inset-0 z-[1003] border-0 bg-black p-0"
            aria-label={snap === 'full' ? 'Recolher painel' : 'Fechar painel'}
            onClick={() => {
              if (snap === 'full') onSnapChange('half');
              else onSnapChange('closed');
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className={`fixed inset-x-0 bottom-0 z-[1004] flex min-h-0 max-h-none flex-col overflow-hidden pb-[max(0px,env(safe-area-inset-bottom))] ${sheetBg}`}
        initial={false}
        animate={{
          height: targetHeightPx,
          y: pullOffset,
        }}
        transition={{
          height: springTransition,
          y: { duration: reduceMotion ? 0 : 0 },
        }}
      >
        <div
          role="button"
          tabIndex={0}
          className="flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 px-4 pb-2 pt-3 touch-none select-none"
          style={{ touchAction: 'none' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            pointerDownY.current = null;
            dragY0.current = null;
          }}
          onClick={onChromeClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChromeClick(e);
            }
          }}
          aria-label={snap === 'half' ? 'Expandir painel' : 'Recolher painel'}
        >
          <div
            className={`h-1 w-12 rounded-full ${wazeUi ? 'bg-[#4b5563]' : 'bg-gray-300'}`}
            aria-hidden
          />
          <span
            className={`text-[11px] font-medium ${wazeUi ? 'text-[#9ca3af]' : 'text-gray-500'}`}
          >
            {snap === 'half'
              ? 'Toque ou arraste para cima · promoções'
              : 'Arraste para baixo com a lista no topo ou use a alça'}
          </span>
        </div>

        {stickyChrome ? (
          <div
            className={`shrink-0 border-b ${wazeUi ? 'border-[#1e2130] bg-[#0f0f0f]' : 'border-gray-100 bg-white'}`}
          >
            {stickyChrome}
          </div>
        ) : null}

        <div
          ref={scrollRef}
          className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain ${
            wazeUi ? 'finmemory-waze-scroll' : ''
          }`}
          style={{ touchAction: 'pan-y' }}
        >
          {children}
        </div>
      </motion.div>
    </>
  );
}

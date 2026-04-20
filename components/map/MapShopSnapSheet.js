'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

/** translateY % — 100 = fora, 65 = peek (~35% visível), 8 = expandido (~92% visível) */
export const MAP_SHOP_SNAP = { closed: 100, peek: 65, expanded: 8 };

const SNAP = MAP_SHOP_SNAP;

/** Desaceleração suave (perto do Maps) — sem “snap” seco */
const TRANSITION = 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)';

function pctForSnap(s) {
  if (s === 'expanded') return SNAP.expanded;
  if (s === 'peek') return SNAP.peek;
  return SNAP.closed;
}

function nearestSnap(pct) {
  const opts = [
    ['expanded', SNAP.expanded],
    ['peek', SNAP.peek],
    ['closed', SNAP.closed],
  ];
  let best = 'closed';
  let bestD = Infinity;
  for (const [k, v] of opts) {
    const d = Math.abs(pct - v);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

/**
 * Bottom sheet da loja no mapa (mobile) — snaps translateY estilo Google Maps.
 * @param {object} p
 * @param {'closed'|'peek'|'expanded'} p.sheetSnap
 * @param {(next: 'closed'|'peek'|'expanded') => void} p.onSheetSnapChange
 * @param {() => void} p.onRequestClose — backdrop / fechar loja
 * @param {boolean} p.wazeUi
 * @param {object|null} p.shopStore
 * @param {boolean} p.shopLoading
 * @param {string} p.shopErr
 * @param {number} p.promoCount — total para badge (ofertas + encartes)
 * @param {import('react').ReactNode} p.children — conteúdo rolável expandido (layout Google Maps)
 * @param {(m: { translatePct: number; snap: string; isDragging: boolean; bottomInsetPx: number }) => void} [p.onVisualMetrics] — padding do mapa / detents
 */
export default function MapShopSnapSheet({
  sheetSnap,
  onSheetSnapChange,
  onRequestClose,
  wazeUi,
  shopStore,
  shopLoading,
  shopErr,
  promoCount,
  children,
  onVisualMetrics,
}) {
  const sheetRef = useRef(null);
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);
  const sheetSnapRef = useRef(sheetSnap);
  sheetSnapRef.current = sheetSnap;
  const dragPctLiveRef = useRef(pctForSnap(sheetSnap));

  const [isDragging, setIsDragging] = useState(false);
  /** null = usar sheetSnap; número = translateY % durante arraste */
  const [dragTranslatePct, setDragTranslatePct] = useState(null);

  const metricsRafRef = useRef(null);
  const onVisualMetricsRef = useRef(onVisualMetrics);
  onVisualMetricsRef.current = onVisualMetrics;
  const draggingRef = useRef(false);

  const reportVisualMetrics = useCallback(() => {
    const fn = onVisualMetricsRef.current;
    if (!fn) return;
    const pct = dragPctLiveRef.current;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
    const bottomInsetPx = vh > 0 ? Math.max(0, ((100 - pct) / 100) * vh) : 0;
    fn({
      translatePct: pct,
      snap: sheetSnapRef.current,
      isDragging: draggingRef.current,
      bottomInsetPx,
    });
  }, []);

  const scheduleVisualMetrics = useCallback(() => {
    if (!onVisualMetricsRef.current) return;
    if (metricsRafRef.current != null) return;
    metricsRafRef.current = requestAnimationFrame(() => {
      metricsRafRef.current = null;
      reportVisualMetrics();
    });
  }, [reportVisualMetrics]);

  useEffect(() => {
    if (isDragging) return;
    dragPctLiveRef.current = pctForSnap(sheetSnap);
    reportVisualMetrics();
  }, [sheetSnap, isDragging, reportVisualMetrics]);

  const resolveGestureEnd = useCallback(
    (startY, endY, startT, anchorPct, currentPct) => {
      const deltaPx = endY - startY;
      const duration = Date.now() - startT;
      const snapNow = sheetSnapRef.current;

      let nextSnap = snapNow;

      if (Math.abs(deltaPx) < 15 && duration < 200 && snapNow === 'peek') {
        nextSnap = 'expanded';
      } else if (deltaPx > 60) {
        if (snapNow === 'expanded') nextSnap = 'peek';
        else if (snapNow === 'peek') nextSnap = 'closed';
      } else if (deltaPx < -60) {
        nextSnap = 'expanded';
      } else {
        nextSnap = nearestSnap(currentPct);
      }

      if (nextSnap !== snapNow) {
        suppressClickRef.current = true;
      }

      setIsDragging(false);
      setDragTranslatePct(null);
      draggingRef.current = false;

      if (nextSnap === 'closed') {
        dragPctLiveRef.current = SNAP.closed;
        onRequestClose();
      } else {
        onSheetSnapChange(nextSnap);
        dragPctLiveRef.current = pctForSnap(nextSnap);
      }
      requestAnimationFrame(() => reportVisualMetrics());
    },
    [onRequestClose, onSheetSnapChange, reportVisualMetrics]
  );

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !isDragging) return undefined;
    const blockScroll = (ev) => {
      ev.preventDefault();
    };
    el.addEventListener('touchmove', blockScroll, { passive: false });
    return () => el.removeEventListener('touchmove', blockScroll);
  }, [isDragging]);

  const onPointerDown = (e) => {
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = e.target;
    if (t && typeof t.closest === 'function' && t.closest('[data-sheet-no-drag]')) {
      gestureRef.current = null;
      return;
    }
    const y = e.clientY;
    const anchor = pctForSnap(sheetSnapRef.current);
    gestureRef.current = {
      pointerId: e.pointerId,
      anchorPct: anchor,
      startY: y,
      startT: Date.now(),
    };
    dragPctLiveRef.current = anchor;
    draggingRef.current = true;
    setIsDragging(true);
    setDragTranslatePct(anchor);
    scheduleVisualMetrics();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  };

  const onPointerMove = (e) => {
    const g = gestureRef.current;
    if (!g || !e.isPrimary || e.pointerId !== g.pointerId) return;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
    const delta = ((e.clientY - g.startY) / vh) * 100;
    const next = Math.min(100, Math.max(4, g.anchorPct + delta));
    dragPctLiveRef.current = next;
    setDragTranslatePct(next);
    scheduleVisualMetrics();
  };

  const onPointerUp = (e) => {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    gestureRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {
      /* ignore */
    }
    const endY = e.clientY;
    const currentPct = dragPctLiveRef.current;
    resolveGestureEnd(g.startY, endY, g.startT, g.anchorPct, currentPct);
  };

  const onPointerCancel = (e) => {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    gestureRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {
      /* ignore */
    }
    draggingRef.current = false;
    setIsDragging(false);
    setDragTranslatePct(null);
    dragPctLiveRef.current = pctForSnap(sheetSnapRef.current);
    requestAnimationFrame(() => reportVisualMetrics());
  };

  const translatePct = dragTranslatePct != null ? dragTranslatePct : pctForSnap(sheetSnap);

  const showBackdrop = sheetSnap !== 'closed';

  const handleBar = (
    <div
      style={{
        width: 36,
        height: 4,
        borderRadius: 2,
        background: '#D1D5DB',
        margin: '10px auto 8px',
        flexShrink: 0,
        cursor: 'grab',
      }}
    />
  );

  return (
    <>
      {showBackdrop ? (
        <button
          type="button"
          aria-label="Fechar painel"
          className={`fixed inset-0 z-[998] border-0 p-0 ${wazeUi ? 'bg-black/70' : 'bg-black/50'}`}
          onClick={onRequestClose}
        />
      ) : null}

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className={`fixed inset-x-0 bottom-0 z-[999] flex max-h-none flex-col ${
          wazeUi
            ? 'rounded-t-2xl border-t border-[#2a2d3a] bg-[#13161f]'
            : 'rounded-t-2xl border-t border-gray-200 bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.12)]'
        }`}
        style={{
          height: '100dvh',
          maxHeight: '100dvh',
          transform: `translateY(${translatePct}%)`,
          transition: isDragging ? 'none' : TRANSITION,
          willChange: 'transform',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={(ev) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            ev.preventDefault();
            ev.stopPropagation();
          }
        }}
      >
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
            wazeUi ? '' : ''
          }`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {handleBar}

          {sheetSnap === 'peek' && shopStore ? (
            <div className="shrink-0 px-4 pb-4 transition-transform active:scale-[0.99] motion-reduce:active:scale-100">
              {shopLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className={`h-7 w-7 animate-spin ${wazeUi ? 'text-[#2ecc71]' : 'text-[#2ECC49]'}`} />
                </div>
              ) : (
                <>
                  <h2
                    className={`text-[16px] font-bold leading-snug ${wazeUi ? 'text-[#f0f0f0]' : 'text-gray-900'}`}
                    style={{ fontSize: 16 }}
                  >
                    {shopStore.name}
                  </h2>
                  <p
                    className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      wazeUi ? 'bg-[#1e3d2a] text-[#2ecc71]' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {promoCount} promoç{promoCount === 1 ? 'ão' : 'ões'}
                  </p>
                  {shopErr ? (
                    <p className={`mt-2 text-xs ${wazeUi ? 'text-red-400' : 'text-red-600'}`}>{shopErr}</p>
                  ) : null}
                  <p className={`mt-3 text-center text-[13px] ${wazeUi ? 'text-[#888]' : 'text-gray-500'}`}>
                    Toque ou arraste para ver ofertas ↑
                  </p>
                </>
              )}
            </div>
          ) : null}

          {sheetSnap === 'expanded' ? (
            <div
              data-sheet-no-drag
              className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-8 ${
                wazeUi ? 'finmemory-waze-scroll touch-pan-y' : 'touch-pan-y'
              }`}
              style={{ touchAction: 'pan-y' }}
            >
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

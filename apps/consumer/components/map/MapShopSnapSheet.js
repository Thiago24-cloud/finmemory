'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

/** translateY % — 100 = fora, 65 = peek (~35% visível), 8 = expandido (~92% visível) */
export const MAP_SHOP_SNAP = { closed: 100, peek: 65, expanded: 8 };

const SNAP = MAP_SHOP_SNAP;

/** Desaceleração suave (perto do Maps) — sem “snap” seco */
const TRANSITION = 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)';
const DRAG_DEADZONE_PX_ANDROID = 3;
const DRAG_DEADZONE_PX_IOS = 5;
const SWIPE_VELOCITY_ANDROID = 0.5;
const SWIPE_VELOCITY_IOS = 0.62;
const SWIPE_DISTANCE_ANDROID = 52;
const SWIPE_DISTANCE_IOS = 64;

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
  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = String(navigator.userAgent || '').toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }, []);
  const dragDeadzonePx = isIOS ? DRAG_DEADZONE_PX_IOS : DRAG_DEADZONE_PX_ANDROID;
  const swipeVelocityThreshold = isIOS ? SWIPE_VELOCITY_IOS : SWIPE_VELOCITY_ANDROID;
  const swipeDistanceThreshold = isIOS ? SWIPE_DISTANCE_IOS : SWIPE_DISTANCE_ANDROID;

  const sheetRef = useRef(null);
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);
  const sheetSnapRef = useRef(sheetSnap);
  sheetSnapRef.current = sheetSnap;
  const dragPctLiveRef = useRef(pctForSnap(sheetSnap));

  const [isDragging, setIsDragging] = useState(false);

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
      const velocity = duration > 0 ? deltaPx / duration : 0;

      let nextSnap = snapNow;

      if (Math.abs(deltaPx) < 12 && duration < 180 && snapNow === 'peek') {
        nextSnap = 'expanded';
      } else if (velocity >= swipeVelocityThreshold) {
        // Swipe-down rápido fecha/recolhe sem exigir grande distância.
        nextSnap = snapNow === 'expanded' ? 'peek' : 'closed';
      } else if (velocity <= -swipeVelocityThreshold) {
        // Swipe-up rápido expande imediatamente.
        nextSnap = 'expanded';
      } else if (deltaPx > swipeDistanceThreshold) {
        if (snapNow === 'expanded') nextSnap = 'peek';
        else if (snapNow === 'peek') nextSnap = 'closed';
      } else if (deltaPx < -swipeDistanceThreshold) {
        nextSnap = 'expanded';
      } else {
        nextSnap = nearestSnap(currentPct);
      }

      if (nextSnap !== snapNow) {
        suppressClickRef.current = true;
      }

      setIsDragging(false);
      draggingRef.current = false;
      // Restaura transform via CSS para que a transição de snap seja controlada pelo estilo declarativo.
      if (sheetRef.current) sheetRef.current.style.transform = '';

      if (nextSnap === 'closed') {
        dragPctLiveRef.current = SNAP.closed;
        onRequestClose();
      } else {
        onSheetSnapChange(nextSnap);
        dragPctLiveRef.current = pctForSnap(nextSnap);
      }
      requestAnimationFrame(() => reportVisualMetrics());
    },
    [onRequestClose, onSheetSnapChange, reportVisualMetrics, swipeDistanceThreshold, swipeVelocityThreshold]
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
      // Nested scroll: quando a lista está no topo e o painel está expandido,
      // um swipe para baixo deve fechar o painel em vez de "quicar" no overscroll.
      const scrollEl = t.closest('[data-sheet-no-drag]');
      const atTop = !scrollEl || scrollEl.scrollTop <= 0;
      const isExpanded = sheetSnapRef.current === 'expanded';
      if (!atTop || !isExpanded) {
        // Lista com scroll > 0, ou painel não expandido: delega ao scroll nativo.
        gestureRef.current = null;
        return;
      }
      // scrollTop === 0 + expanded: deixa o gesto cair no handler abaixo
      // para que swipe-down feche o painel (comportamento Google Maps).
    }
    const y = e.clientY;
    const anchor = pctForSnap(sheetSnapRef.current);
    gestureRef.current = {
      pointerId: e.pointerId,
      anchorPct: anchor,
      startY: y,
      startT: Date.now(),
      engaged: false,
    };
    dragPctLiveRef.current = anchor;
    draggingRef.current = false;
    setIsDragging(false);
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
    const movedPx = e.clientY - g.startY;
    if (!g.engaged && Math.abs(movedPx) < dragDeadzonePx) return;
    if (!g.engaged) {
      g.engaged = true;
      draggingRef.current = true;
      setIsDragging(true);
    }
    const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
    const delta = (movedPx / vh) * 100;
    const minPct = isIOS ? 3 : 4;
    const next = Math.min(100, Math.max(minPct, g.anchorPct + delta));
    dragPctLiveRef.current = next;
    // Aplica direto ao DOM — zero re-render por frame durante o arraste.
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${next}%)`;
    }
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
    if (!g.engaged) {
      draggingRef.current = false;
      setIsDragging(false);
      return;
    }
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
    dragPctLiveRef.current = pctForSnap(sheetSnapRef.current);
    if (sheetRef.current) sheetRef.current.style.transform = '';
    requestAnimationFrame(() => reportVisualMetrics());
  };

  const translatePct = pctForSnap(sheetSnap);

  // expanded: backdrop escuro (bloqueia mapa intencionalmente, foco no painel).
  // peek: botão transparente apenas para capturar clique-fora, sem bloquear pins.
  const showDarkBackdrop = sheetSnap === 'expanded';
  const showClearBackdrop = sheetSnap === 'peek';

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
      {showDarkBackdrop ? (
        <button
          type="button"
          aria-label="Fechar painel"
          className={`fixed inset-0 z-[998] border-0 p-0 ${wazeUi ? 'bg-black/70' : 'bg-black/50'}`}
          onClick={onRequestClose}
        />
      ) : showClearBackdrop ? (
        // Transparente: captura clique-fora sem escurecer o mapa nem bloquear os pins.
        <button
          type="button"
          aria-label="Fechar painel"
          className="fixed inset-0 z-[998] border-0 bg-transparent p-0"
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
          // 'none' apenas durante drag ativo iniciado no handle/fora da zona scrollável.
          // Fora do drag, 'pan-y' permite que a lista interna role normalmente (nested scroll).
          touchAction: isDragging ? 'none' : 'pan-y',
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

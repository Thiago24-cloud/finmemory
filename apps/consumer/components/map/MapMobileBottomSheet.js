'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Drawer } from 'vaul';

/**
 * z-index: overlay 1003, folha 1004 — acima dos pins Leaflet (~600)
 * e da barra de busca do mapa (z-[1001]); abaixo de sidebars fixas (1005+).
 */
const Z_OVERLAY = 1003;
const Z_SHEET  = 1004;

/**
 * Bottom sheet do mapa de preços (mobile) — vaul v1 com snap points.
 *
 * Snap points declarativos (sem reimplementar gestos):
 *   closed → open=false   | half → snapHalf (≈35% dvh) | full → snapFull (≈95% dvh)
 *
 * vaul fornece nativamente:
 *  • Conflito de scroll resolvido: handle arrasta sempre; lista só arrasta quando scrollTop===0
 *  • Spring physics + rubber banding nos limites (sem framer-motion custom)
 *  • 60fps via CSS transforms diretos — zero re-renders por frame de drag
 *  • ARIA dialog + foco gerenciado
 *
 * Backdrop dimming proporcional: atualizado imperativo via ref (sem setState por frame).
 *
 * @param {'closed'|'half'|'full'} snap
 * @param {(next:'closed'|'half'|'full')=>void} onSnapChange
 * @param {boolean} [wazeUi]
 * @param {React.ReactNode} children — lista rolável
 * @param {number} [halfDvh=35]
 * @param {number} [fullDvh=95]
 * @param {React.ReactNode} [stickyChrome] — cabeçalho fixo (nome do mercado + busca)
 * @param {(m:{snap:string;bottomInsetPx:number})=>void} [onVisualMetrics]
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
  // Snap points como fração de viewport (0–1): vaul converte para px internamente.
  const snapHalf = halfDvh / 100;
  const snapFull = fullDvh / 100;

  const isOpen = snap !== 'closed';
  const activeSnapPoint = snap === 'full' ? snapFull : snapHalf;

  // Opacidades alvo por snap (Waze vs. standard)
  const overlayHalf = wazeUi ? 0.20 : 0.14;
  const overlayFull = wazeUi ? 0.52 : 0.48;
  const overlayHalfRef = useRef(overlayHalf);
  const overlayFullRef  = useRef(overlayFull);
  overlayHalfRef.current = overlayHalf;
  overlayFullRef.current  = overlayFull;

  // Ref direta ao elemento overlay — evita setState por frame de drag (60fps sem re-renders)
  const overlayRef = useRef(null);

  const setOverlayBg = useCallback((opacity) => {
    const el = overlayRef.current;
    if (el) el.style.backgroundColor = `rgba(0,0,0,${Math.max(0, Math.min(1, opacity))})`;
  }, []);

  // Sincroniza opacidade quando snap muda por estado (ex.: externo, toggle de botão)
  useEffect(() => {
    if (snap === 'full')   setOverlayBg(overlayFullRef.current);
    else if (snap === 'half') setOverlayBg(overlayHalfRef.current);
    else                   setOverlayBg(0);
  }, [snap, setOverlayBg]);

  // Backdrop proporcional durante o arraste — chamado por vaul a cada frame
  // percentageDragged: 0 (fechado) → 1 (snap máximo aberto)
  const onDrag = useCallback((_e, percentageDragged) => {
    setOverlayBg(percentageDragged * overlayFullRef.current);
  }, [setOverlayBg]);

  const onRelease = useCallback((_e, open) => {
    if (!open) setOverlayBg(0);
  }, [setOverlayBg]);

  // Traduz fração do vaul → snap nomeado
  const handleSetActiveSnapPoint = useCallback((fraction) => {
    if (fraction === null || fraction === undefined) {
      setOverlayBg(0);
      onSnapChange('closed');
      return;
    }
    const goFull = Math.abs(fraction - snapFull) < Math.abs(fraction - snapHalf);
    if (goFull) {
      setOverlayBg(overlayFullRef.current);
      onSnapChange('full');
    } else {
      setOverlayBg(overlayHalfRef.current);
      onSnapChange('half');
    }
  }, [onSnapChange, snapHalf, snapFull, setOverlayBg]);

  // Métricas para Leaflet (padding bottom do mapa)
  const onVisualMetricsRef = useRef(onVisualMetrics);
  onVisualMetricsRef.current = onVisualMetrics;

  useEffect(() => {
    const fn = onVisualMetricsRef.current;
    if (!fn) return;
    const fraction = snap === 'full' ? snapFull : snap === 'half' ? snapHalf : 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
    fn({ snap, bottomInsetPx: Math.round(fraction * vh) });
  }, [snap, snapHalf, snapFull]);

  const sheetSurface = [
    'rounded-t-[24px]',
    'border-t border-white/[0.08]',
    'bg-[#0f0f0f]',
    'shadow-[0_-16px_48px_rgba(0,0,0,0.55)]',
    'outline-none focus:outline-none',
  ].join(' ');

  return (
    <Drawer.Root
      open={isOpen}
      onClose={() => { setOverlayBg(0); onSnapChange('closed'); }}
      snapPoints={[snapHalf, snapFull]}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={handleSetActiveSnapPoint}
      dismissible
      modal={false}
      onDrag={onDrag}
      onRelease={onRelease}
    >
      <Drawer.Portal>
        {/*
          Overlay com dimming proporcional à altura.
          pointer-events none no half para não bloquear pins do mapa.
          Atualizado via ref (imperativo) para zero re-renders durante drag.
        */}
        <Drawer.Overlay
          ref={overlayRef}
          className="fixed inset-0"
          style={{
            zIndex: Z_OVERLAY,
            backgroundColor: 'rgba(0,0,0,0)',
            pointerEvents: snap === 'full' ? 'auto' : 'none',
          }}
          onClick={() => {
            if (snap === 'full') onSnapChange('half');
            else onSnapChange('closed');
          }}
        />

        {/*
          height: 100dvh — vaul aplica translateY para expor apenas a fração do snap ativo.
          Conteúdo cresce dentro; handle + stickyChrome ficam sempre no topo visível.
        */}
        <Drawer.Content
          className={`fixed inset-x-0 bottom-0 flex flex-col overflow-hidden pb-[max(0px,env(safe-area-inset-bottom))] ${sheetSurface}`}
          style={{ zIndex: Z_SHEET, height: '100dvh' }}
          aria-label={stickyChrome ? undefined : 'Painel de ofertas'}
        >
          {/* ── Handle ─────────────────────────────────────────────── */}
          <div
            className="flex shrink-0 cursor-grab active:cursor-grabbing flex-col items-center justify-center gap-2 px-4 pb-2 pt-3.5 select-none"
            style={{ touchAction: 'none' }}
          >
            <div className="h-1 w-11 shrink-0 rounded-full bg-[#5c5c5c]" aria-hidden />
            <span className="text-center text-[10px] font-medium leading-tight text-[#737373]">
              {snap === 'half'
                ? 'Arraste para cima para ver ofertas · para baixo para fechar'
                : 'Com a lista no topo, arraste para baixo para recolher'}
            </span>
          </div>

          {/* ── Sticky header: nome do mercado + busca ─────────────── */}
          {stickyChrome ? (
            <div className="shrink-0 border-b border-white/[0.06] bg-[#0f0f0f]">
              {stickyChrome}
            </div>
          ) : null}

          {/* ── Lista de produtos ───────────────────────────────────
              vaul resolve conflito de scroll nativamente:
              • scrollTop > 0 → rola a lista
              • scrollTop === 0 + gesto para baixo → move o painel
          ──────────────────────────────────────────────────────── */}
          <div
            className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain"
            style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

import { useCallback, useRef } from 'react';

const DRAG_THRESHOLD = 48;
const TAP_MAX_DY = 16;

/**
 * Painel inferior estilo Google Maps: peek / expanded, arrastar no cabeçalho e toque na faixa para expandir.
 * @param {object} p
 * @param {'peek'|'expanded'} p.snap
 * @param {(next: 'peek'|'expanded'|'closed') => void} p.onSnapChange
 * @param {boolean} p.wazeUi
 * @param {React.ReactNode} p.children
 * @param {number} [p.peekDvh]
 * @param {number} [p.expandedDvh]
 */
export default function MapMobileBottomSheet({
  snap,
  onSnapChange,
  wazeUi,
  children,
  peekDvh = 35,
  expandedDvh = 92,
}) {
  const dragY0 = useRef(null);
  const snapRef = useRef(snap);
  snapRef.current = snap;
  /** Evita duplo toggle: após touchend o browser dispara click no mesmo alvo. */
  const suppressChromeClickUntil = useRef(0);

  const applySnapFromDrag = useCallback(
    (dy) => {
      const s = snapRef.current;
      if (dy > DRAG_THRESHOLD) {
        if (s === 'expanded') onSnapChange('peek');
        else onSnapChange('closed');
        return;
      }
      if (dy < -DRAG_THRESHOLD) {
        if (s === 'peek') onSnapChange('expanded');
      }
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
        if (s === 'peek') onSnapChange('expanded');
        else onSnapChange('peek');
        return;
      }
      applySnapFromDrag(dy);
    },
    [applySnapFromDrag, onSnapChange]
  );

  /** Mouse / trackpad: mesmo gesto que toque no cabeçalho. */
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
        if (s === 'peek') onSnapChange('expanded');
        else onSnapChange('peek');
        return;
      }
      applySnapFromDrag(dy);
    },
    [applySnapFromDrag, onSnapChange]
  );

  /**
   * Toque rápido no cabeçalho (fallback quando o browser não dispara pointer como esperado).
   * Ignora cliques vindos de botões/links dentro da área de conteúdo que subiu por scroll — só o chrome dispara isto.
   */
  const onChromeClick = useCallback(
    (e) => {
      if (Date.now() < suppressChromeClickUntil.current) return;
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (el.closest('button, a, input, textarea, select, [data-sheet-no-tap-expand]')) return;
      const s = snapRef.current;
      if (s === 'peek') onSnapChange('expanded');
      else onSnapChange('peek');
    },
    [onSnapChange]
  );

  const maxDvh = snap === 'expanded' ? expandedDvh : peekDvh;

  return (
    <>
      {snap === 'expanded' ? (
        <button
          type="button"
          className={`fixed inset-0 z-[1003] border-0 p-0 ${wazeUi ? 'bg-black/55' : 'bg-black/40'}`}
          aria-label="Reduzir painel"
          onClick={() => onSnapChange('peek')}
        />
      ) : null}
      <div
        className={`fixed inset-x-0 bottom-0 z-[1004] flex min-h-0 max-h-none flex-col overflow-hidden pb-[max(0px,env(safe-area-inset-bottom))] ${
          wazeUi
            ? 'rounded-t-2xl border-t border-[#2a2d3a] bg-[#13161f] shadow-[0_-8px_28px_rgba(0,0,0,0.28)]'
            : 'rounded-t-2xl border-t border-gray-200 bg-white shadow-[0_-8px_28px_rgba(0,0,0,0.12)]'
        }`}
        style={{
          maxHeight: `${maxDvh}dvh`,
          transition: 'max-height 0.28s cubic-bezier(0.25, 0.8, 0.25, 1)',
        }}
      >
        {/* Faixa larga estilo Maps: arrastar + toque para expandir / recolher */}
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
          aria-label={snap === 'peek' ? 'Expandir painel' : 'Recolher painel'}
        >
          <div
            className={`h-1 w-12 rounded-full ${wazeUi ? 'bg-[#3d424d]' : 'bg-gray-300'}`}
            aria-hidden
          />
          <span
            className={`text-[11px] font-medium ${wazeUi ? 'text-[#6b7280]' : 'text-gray-500'}`}
          >
            {snap === 'peek' ? 'Toque ou arraste para cima · promoções' : 'Toque ou arraste para baixo'}
          </span>
        </div>
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain ${
            wazeUi ? 'finmemory-waze-scroll' : ''
          }`}
          style={{ touchAction: 'pan-y' }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

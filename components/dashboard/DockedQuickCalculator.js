'use client';

import Link from 'next/link';
import { Calculator, ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { safeEvalExpression } from '../../lib/safeExpressionEval';
import { useCalculatorDock } from './CalculatorDockContext';
import { CalcFlyParticle } from './CalcFlyParticle';
import { CALC_DRAG_MIME } from '../../lib/calcDragMime';

/** Altura aproximada do BottomNav + safe area (alinha com FloatingCalculatorFab). */
const MOBILE_DOCK_BOTTOM = 'calc(4.5rem + env(safe-area-inset-bottom, 0px))';

/**
 * Calculadora rápida acoplada: barra fina no mobile (acima do BottomNav) e painel fixo à direita no desktop.
 */
export function DockedQuickCalculator() {
  const {
    expr,
    setExpr,
    appendChar,
    appendAmount,
    clear,
    backspace,
    mobileExpanded,
    setMobileExpanded,
    pulseKey,
    desktopOpen,
    setDesktopOpen,
    flyParticle,
  } = useCalculatorDock();

  const handleCalcDragOver = (e) => {
    const types = Array.from(e.dataTransfer?.types || []);
    if (types.includes(CALC_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleCalcDrop = (e) => {
    const raw = e.dataTransfer.getData(CALC_DRAG_MIME);
    if (!raw) return;
    e.preventDefault();
    try {
      const payload = JSON.parse(raw);
      const amt = Number(payload.amount);
      const sign = payload.sign === '-' ? '-' : '+';
      if (!Number.isFinite(amt) || amt <= 0) return;
      appendAmount(amt, sign, {
        flyFrom: { clientX: e.clientX, clientY: e.clientY },
        flyLabel: payload.flyLabel,
      });
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileExpanded(true);
      }
    } catch {
      /* ignore */
    }
  };

  const result = safeEvalExpression(expr);
  const resultLabel =
    result != null
      ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 }).format(result)
      : '—';

  const keysRow = (keys) =>
    keys.map((k) => (
      <button
        key={k}
        type="button"
        onClick={() => appendChar(k)}
        className="py-2.5 rounded-xl bg-[#f8fafc] font-semibold text-sm text-[#111] border border-[#e5e7eb] hover:bg-[#f1f5f9] active:scale-[0.98]"
      >
        {k}
      </button>
    ));

  const keypad = (
    <div className="space-y-2">
      <div className="rounded-2xl bg-[#0b1220] text-white p-3 min-h-[3.25rem] flex flex-col justify-center">
        <p className="text-[10px] text-white/55 m-0 mb-0.5">Expressão</p>
        <p className="text-xs font-mono break-all m-0 leading-snug max-h-[4.5rem] overflow-y-auto">{expr || '0'}</p>
        <p
          key={pulseKey}
          className={cn(
            'text-lg font-bold text-[#2ECC49] m-0 mt-1.5 tabular-nums',
            pulseKey > 0 && 'finmemory-calc-pulse'
          )}
        >
          {resultLabel}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-1.5">{keysRow(['7', '8', '9', '/'])}</div>
      <div className="grid grid-cols-4 gap-1.5">{keysRow(['4', '5', '6', '*'])}</div>
      <div className="grid grid-cols-4 gap-1.5">{keysRow(['1', '2', '3', '-'])}</div>
      <div className="grid grid-cols-4 gap-1.5">
        {keysRow(['0', '.', '(', ')'])}
        <button
          type="button"
          onClick={() => appendChar('+')}
          className="py-2.5 rounded-xl bg-[#f8fafc] font-semibold text-sm text-[#111] border border-[#e5e7eb] hover:bg-[#f1f5f9]"
        >
          +
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={backspace}
          className="flex-1 py-2 rounded-xl border border-[#e5e7eb] text-xs font-medium text-[#333] hover:bg-[#f8fafc]"
        >
          Apagar
        </button>
        <button
          type="button"
          onClick={clear}
          className="flex-1 py-2 rounded-xl border border-[#e5e7eb] text-xs font-medium text-[#333] hover:bg-[#f8fafc]"
        >
          Limpar
        </button>
      </div>
      <Link
        href="/calculadora"
        className="block text-center text-[11px] font-semibold text-[#2ECC49] hover:underline pt-0.5"
      >
        Calculadora de economia (completa)
      </Link>
    </div>
  );

  return (
    <>
      {flyParticle && (
        <CalcFlyParticle
          key={flyParticle.id}
          x0={flyParticle.x0}
          y0={flyParticle.y0}
          x1={flyParticle.x1}
          y1={flyParticle.y1}
          label={flyParticle.label}
        />
      )}
      {/* Desktop: painel lateral fixo */}
      <aside
        onDragOver={handleCalcDragOver}
        onDrop={handleCalcDrop}
        className={cn(
          'hidden lg:flex flex-col fixed right-0 top-0 bottom-0 z-[42]',
          'border-l border-[#e5e7eb] bg-white/98 backdrop-blur-md shadow-xl',
          'w-[min(300px,28vw)] transition-transform duration-300 ease-out',
          desktopOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="Calculadora rápida"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[#f0f0f0] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Calculator className="h-5 w-5 text-[#2ECC49] shrink-0" aria-hidden />
            <span className="text-sm font-semibold text-[#333] truncate">Calculadora</span>
          </div>
          <button
            type="button"
            onClick={() => setDesktopOpen(false)}
            className="p-2 rounded-xl hover:bg-[#f3f4f6] text-[#666] shrink-0"
            title="Ocultar painel (o conteúdo ocupa a largura toda)"
            aria-label="Ocultar calculadora lateral"
          >
            <PanelRightClose className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 pb-6">{keypad}</div>
      </aside>

      {/* Botão para reabrir painel no desktop quando fechado */}
      {!desktopOpen && (
        <button
          type="button"
          onClick={() => setDesktopOpen(true)}
          onDragOver={handleCalcDragOver}
          onDrop={(e) => {
            handleCalcDrop(e);
            setDesktopOpen(true);
          }}
          className="hidden lg:flex fixed right-3 top-1/2 -translate-y-1/2 z-[42] h-11 w-11 rounded-2xl border border-[#e5e7eb] bg-white shadow-md items-center justify-center text-[#2ECC49] hover:bg-[#f8fafc]"
          aria-label="Mostrar calculadora lateral"
        >
          <PanelRightOpen className="h-5 w-5" />
        </button>
      )}

      {/* Mobile: barra fina + expansão */}
      <div
        onDragOver={handleCalcDragOver}
        onDrop={handleCalcDrop}
        className={cn(
          'lg:hidden fixed left-0 right-0 z-[43] flex flex-col',
          'border-t border-[#e5e7eb] bg-white/98 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.08)]',
          'transition-[max-height] duration-300 ease-out safe-area-pb'
        )}
        style={{
          bottom: MOBILE_DOCK_BOTTOM,
          maxHeight: mobileExpanded ? 'min(52vh, 420px)' : '60px',
        }}
      >
        <button
          type="button"
          onClick={() => setMobileExpanded((v) => !v)}
          className="flex items-center justify-between gap-2 px-3 h-[52px] shrink-0 min-h-[52px] max-h-[60px] w-full text-left"
          aria-expanded={mobileExpanded}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Calculator className="h-5 w-5 text-[#2ECC49] shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-[10px] text-[#888] m-0 leading-none mb-0.5">Total</p>
              <p className="text-base font-bold text-[#0f172a] tabular-nums truncate m-0 leading-tight">{resultLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-[#666]">
            <span className="text-[10px] font-medium uppercase tracking-wide">
              {mobileExpanded ? 'Recolher' : 'Expandir'}
            </span>
            {mobileExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </div>
        </button>
        {mobileExpanded && (
          <div className="px-3 pb-2 overflow-y-auto max-h-[min(46vh,380px)] border-t border-[#f3f4f6]">
            <div className="flex justify-end py-1">
              <button
                type="button"
                onClick={() => setMobileExpanded(false)}
                className="p-1.5 rounded-lg text-[#999] hover:bg-[#f3f4f6]"
                aria-label="Fechar teclado"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {keypad}
          </div>
        )}
      </div>
    </>
  );
}

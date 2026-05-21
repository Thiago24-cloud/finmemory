'use client';

import { memo, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calculator, ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { safeEvalExpression } from '../../lib/safeExpressionEval';
import { useCalculatorDock } from './CalculatorDockContext';
import { CalcFlyParticle } from './CalcFlyParticle';
import { CALC_DRAG_MIME } from '../../lib/calcDragMime';

/** Altura aproximada do BottomNav + safe area (alinha com FloatingCalculatorFab). */
const MOBILE_DOCK_BOTTOM = 'calc(4.5rem + env(safe-area-inset-bottom, 0px))';

const CALC_KEY =
  'py-2.5 rounded-xl text-sm font-semibold border border-border bg-muted text-foreground shadow-sm hover:bg-muted/80 active:bg-muted/90 dark:active:bg-secondary/70 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90 dark:shadow-none touch-manipulation select-none';

const CalcKey = memo(function CalcKey({ label, onPress }) {
  return (
    <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={onPress} className={CALC_KEY}>
      {label}
    </button>
  );
});

const CALC_ACTION =
  'flex-1 py-2 rounded-xl border border-border text-xs font-semibold bg-secondary/40 text-secondary-foreground hover:bg-secondary/60 active:bg-secondary/70 dark:bg-muted/40 dark:text-foreground dark:hover:bg-muted/60 touch-manipulation';

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

  const [resultPulse, setResultPulse] = useState(false);
  useEffect(() => {
    if (pulseKey <= 0) return;
    setResultPulse(true);
    const t = window.setTimeout(() => setResultPulse(false), 450);
    return () => window.clearTimeout(t);
  }, [pulseKey]);

  const result = safeEvalExpression(expr);
  const resultLabel =
    result != null
      ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 }).format(result)
      : '—';

  const keysRow = (keys) => keys.map((k) => <CalcKey key={k} label={k} onPress={() => appendChar(k)} />);

  const keypad = (
    <div className="space-y-2">
      <div className="rounded-2xl bg-[#0b1220] text-white p-3 min-h-[3.25rem] flex flex-col justify-center">
        <p className="text-[10px] text-white/55 m-0 mb-0.5">Expressão</p>
        <p className="text-xs font-mono break-all m-0 leading-snug max-h-[4.5rem] overflow-y-auto tabular-nums">
          {expr || '0'}
        </p>
        <p
          className={cn(
            'text-lg font-bold text-primary m-0 mt-1.5 tabular-nums min-h-[1.35rem]',
            resultPulse && 'finmemory-calc-pulse'
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
        <CalcKey label="+" onPress={() => appendChar('+')} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={backspace} className={CALC_ACTION}>
          Apagar
        </button>
        <button type="button" onClick={clear} className={CALC_ACTION}>
          Limpar
        </button>
      </div>
      <Link
        href="/calculadora"
        className="block text-center text-[11px] font-semibold text-primary hover:underline pt-0.5"
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
          'border-l border-border bg-white/98 backdrop-blur-md shadow-xl',
          'dark:bg-card/95 dark:border-border dark:text-foreground',
          'w-[min(300px,28vw)] transition-transform duration-300 ease-out',
          desktopOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="Calculadora rápida"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[#f0f0f0] dark:border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Calculator className="h-5 w-5 text-primary shrink-0" aria-hidden />
            <span className="text-sm font-semibold text-[#333] dark:text-foreground truncate">Calculadora</span>
          </div>
          <button
            type="button"
            onClick={() => setDesktopOpen(false)}
            className="p-2 rounded-xl hover:bg-[#f3f4f6] dark:hover:bg-muted text-[#666] dark:text-muted-foreground shrink-0"
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
          className="hidden lg:flex fixed right-3 top-1/2 -translate-y-1/2 z-[42] h-11 w-11 rounded-2xl border border-border bg-white dark:bg-card dark:border-border shadow-md items-center justify-center text-primary hover:bg-muted dark:hover:bg-secondary"
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
          'border-t border-border bg-white/98 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.08)]',
          'dark:bg-card/95 dark:shadow-[0_-8px_28px_rgba(0,0,0,0.45)]',
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
            <Calculator className="h-5 w-5 text-primary shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground m-0 leading-none mb-0.5">Total</p>
              <p className="text-base font-bold text-foreground tabular-nums truncate m-0 leading-tight">{resultLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
            <span className="text-[10px] font-medium uppercase tracking-wide">
              {mobileExpanded ? 'Recolher' : 'Expandir'}
            </span>
            {mobileExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </div>
        </button>
        {mobileExpanded && (
          <div className="px-3 pb-2 overflow-y-auto max-h-[min(46vh,380px)] border-t border-[#f3f4f6] dark:border-border">
            <div className="flex justify-end py-1">
              <button
                type="button"
                onClick={() => setMobileExpanded(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
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

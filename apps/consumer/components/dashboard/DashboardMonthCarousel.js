'use client';

import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { DASHBOARD } from '../../lib/appMicrocopy';
import { useCalculatorDockOptional } from './CalculatorDockContext';
import { pushAmountToCalculator } from '../../lib/pushAmountToCalculator';

const fmtCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(
    Math.abs(Number(v) || 0)
  );

function labelForYm(ym) {
  const [y, m] = ym.split('-');
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  const short = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const cap = short.charAt(0).toUpperCase() + short.slice(1);
  const yy = String(date.getFullYear()).slice(-2);
  return `${cap} ’${yy}`;
}

/**
 * Carrossel horizontal de meses com total por mês (snap, scroll nativo).
 */
export function DashboardMonthCarousel({
  months = [],
  selectedMonth,
  onMonthChange,
  monthTotals = {},
  loading = false,
  className,
}) {
  const calcDock = useCalculatorDockOptional();
  const stripRef = useRef(null);
  const chipRefs = useRef({});

  useEffect(() => {
    if (!selectedMonth || !stripRef.current) return;
    const el = chipRefs.current[selectedMonth];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedMonth, months]);

  if (!months.length) return null;

  return (
    <div className={cn(className)} data-tour-id="dashboard-month-carousel">
      <p className="text-[11px] font-medium text-muted-foreground mb-2">{DASHBOARD.monthCarouselLabel}</p>
      <div
        ref={stripRef}
        className={cn(
          'flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide',
          'touch-pan-x'
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
        role="tablist"
        aria-label="Escolher mês para os gastos"
      >
        {months.map((ym) => {
          const selected = selectedMonth === ym;
          const total = monthTotals[ym] ?? 0;
          return (
            <button
              key={ym}
              type="button"
              role="tab"
              aria-selected={selected}
              ref={(node) => {
                chipRefs.current[ym] = node;
              }}
              onClick={(e) => {
                onMonthChange?.(ym);
                if (!loading && calcDock && total > 0) {
                  pushAmountToCalculator(calcDock, total, '-', e, fmtCurrency(total));
                }
              }}
              title={calcDock && total > 0 && !loading ? 'Toque para filtrar o mês e enviar o total à calculadora' : undefined}
              className={cn(
                'snap-start shrink-0 min-w-[108px] max-w-[124px] rounded-xl px-3 py-2 text-left transition-colors border isolate',
                calcDock && total > 0 && !loading && 'cursor-pointer active:scale-[0.98]',
                /* Fundo opaco — bg-card/80 deixava ver o verde do BalanceCard por baixo (efeito “duplicado”) */
                selected
                  ? 'border-[#00E676]/55 bg-[#0f1a14] shadow-sm'
                  : 'border-[#1E2A3A] bg-[#0A0E1A] hover:border-[#00E676]/25 hover:bg-[#0d1218]'
              )}
            >
              <p className="text-[11px] font-semibold text-foreground truncate leading-tight">{labelForYm(ym)}</p>
              <p className="text-[13px] font-bold tabular-nums text-[#00E676] mt-0.5 leading-tight antialiased">
                {loading ? '…' : fmtCurrency(total)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

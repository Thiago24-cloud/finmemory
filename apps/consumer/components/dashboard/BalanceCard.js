'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCalculatorDockOptional } from './CalculatorDockContext';
import { pushAmountToCalculator } from '../../lib/pushAmountToCalculator';

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function BalanceCard({
  balance,
  className,
  label,
  loading = false,
  income,
  compact = false,
  missionsSlot = null,
}) {
  const [isVisible, setIsVisible] = useState(true);
  const calcDock = useCalculatorDockOptional();
  const absBalance = Math.abs(Number(balance) || 0);
  const incomeVal = Number(income) || 0;
  const canCalc = Boolean(calcDock) && !loading && isVisible;

  const pushExpense = (e, amount) => {
    pushAmountToCalculator(calcDock, amount, '-', e, fmt(amount));
  };

  const pushIncome = (e, amount) => {
    pushAmountToCalculator(calcDock, amount, '+', e, fmt(amount));
  };

  const calcHint = canCalc ? 'Toque para enviar à calculadora' : undefined;

  return (
    <div
      className={cn(
        'relative overflow-hidden border border-[#1E2A3A]',
        compact ? 'rounded-xl p-3.5' : 'rounded-2xl p-5',
        className
      )}
      style={{ background: 'linear-gradient(135deg, #0D2B1A 0%, #0A1E2E 100%)' }}
    >
      <div
        className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #00E676 0%, transparent 70%)', opacity: 0.08, transform: 'translate(30%, -30%)' }}
      />
      <div className={cn('flex items-start justify-between relative', compact ? 'mb-2' : 'mb-3')}>
        <p className={cn('text-[#8899AA] font-medium', compact ? 'text-[11px]' : 'text-[13px]')}>
          {label || 'Total de Gastos'}
        </p>
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          aria-label={isVisible ? 'Ocultar saldo' : 'Mostrar saldo'}
        >
          {isVisible ? (
            <Eye className="h-4 w-4 text-[#8899AA]" />
          ) : (
            <EyeOff className="h-4 w-4 text-[#8899AA]" />
          )}
        </button>
      </div>

      <button
        type="button"
        disabled={!canCalc || absBalance <= 0}
        onClick={(e) => pushExpense(e, absBalance)}
        title={calcHint}
        className={cn(
          'font-black text-[#F0F4FF] leading-tight relative text-left w-full',
          compact ? 'text-[1.5rem]' : 'text-[2rem]',
          canCalc && absBalance > 0 && 'cursor-pointer rounded-lg hover:bg-white/[0.04] transition-colors -mx-1 px-1',
          (!canCalc || absBalance <= 0) && 'cursor-default'
        )}
        aria-live="polite"
        aria-label={
          canCalc && absBalance > 0
            ? `${label || 'Gastos'}: ${fmt(absBalance)}. Toque para calculadora.`
            : undefined
        }
      >
        {loading ? '••••••' : isVisible ? fmt(absBalance) : '••••••'}
      </button>

      {missionsSlot ? (
        <div className={cn('relative', compact ? 'mt-2.5' : 'mt-3')}>{missionsSlot}</div>
      ) : null}

      {incomeVal > 0 && (
        <div className={cn('flex gap-2 sm:gap-3', compact ? 'mt-2.5' : 'mt-4')}>
          <button
            type="button"
            disabled={!canCalc}
            onClick={(e) => pushIncome(e, incomeVal)}
            title={calcHint}
            className={cn(
              'flex-1 bg-[#00E676]/10 rounded-xl border border-[#00E676]/20 text-left transition-colors',
              compact ? 'px-2 py-1.5' : 'px-3 py-2',
              canCalc && 'hover:bg-[#00E676]/15 hover:border-[#00E676]/35 cursor-pointer active:scale-[0.99]',
              !canCalc && 'cursor-default'
            )}
            aria-label={canCalc ? `Entradas ${fmt(incomeVal)}. Toque para calculadora.` : undefined}
          >
            <p className={cn('text-[#8899AA] mb-0.5', compact ? 'text-[10px]' : 'text-[11px]')}>Entradas</p>
            <p className={cn('text-[#00E676] font-bold', compact ? 'text-xs' : 'text-[14px]')}>
              {isVisible ? fmt(incomeVal) : '••••'}
            </p>
          </button>
          <button
            type="button"
            disabled={!canCalc || absBalance <= 0}
            onClick={(e) => pushExpense(e, absBalance)}
            title={calcHint}
            className={cn(
              'flex-1 bg-red-500/10 rounded-xl border border-red-500/20 text-left transition-colors',
              compact ? 'px-2 py-1.5' : 'px-3 py-2',
              canCalc && absBalance > 0 && 'hover:bg-red-500/15 hover:border-red-500/35 cursor-pointer active:scale-[0.99]',
              (!canCalc || absBalance <= 0) && 'cursor-default'
            )}
            aria-label={canCalc && absBalance > 0 ? `Saídas ${fmt(absBalance)}. Toque para calculadora.` : undefined}
          >
            <p className={cn('text-[#8899AA] mb-0.5', compact ? 'text-[10px]' : 'text-[11px]')}>Saídas</p>
            <p className={cn('text-red-400 font-bold', compact ? 'text-xs' : 'text-[14px]')}>
              {isVisible ? fmt(absBalance) : '••••'}
            </p>
          </button>
        </div>
      )}

      <p className={cn('text-[#8899AA] relative', compact ? 'text-[10px] mt-2' : 'text-[11px] mt-3')}>
        {loading ? 'Atualizando saldos…' : canCalc ? 'Toque nos valores para a calculadora · Atualizado agora' : 'Atualizado agora'}
      </p>
    </div>
  );
}

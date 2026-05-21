'use client';

import { cn } from '../../lib/utils';

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(v) || 0
  );

/**
 * Campo "Saldo hoje" — valor calculado + input editável (layout compacto).
 */
export function SaldoHojeField({
  label = 'Saldo hoje',
  saldoHoje,
  value,
  onChange,
  onBlurSync,
  loading = false,
  contasCount = 0,
  usingMock = false,
  fieldClass,
  labelClass,
  hintExtra = null,
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label className={cn(labelClass, 'mb-0')}>{label}</label>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums text-zinc-100',
            loading && 'animate-pulse text-zinc-600'
          )}
          aria-live="polite"
        >
          {loading ? '…' : fmt(saldoHoje)}
        </span>
      </div>
      <input
        type="number"
        step="0.01"
        className={fieldClass}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={() => onBlurSync?.()}
        aria-label={`${label} — valor editável`}
      />
      <p className="mt-1 text-[10px] text-zinc-600 leading-snug">
        {loading
          ? 'Recalculando…'
          : contasCount > 0
            ? `${contasCount} conta${contasCount === 1 ? '' : 's'} · débito + disponível no cartão`
            : usingMock
              ? 'Exemplo — conecte o Open Finance'
              : 'Sem contas conectadas'}
      </p>
      {hintExtra ? <p className="mt-1 text-[10px] text-zinc-500">{hintExtra}</p> : null}
    </div>
  );
}

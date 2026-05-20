'use client';

import { cn } from '../../lib/utils';

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(v) || 0
  );

/**
 * Campo "Saldo hoje (poder de compra sugerido)" — valor calculado em pill + input editável.
 */
export function SaldoHojeField({
  label = 'Saldo hoje (poder de compra sugerido)',
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
      <label className={labelClass}>{label}</label>
      <div
        className={cn(
          'mt-1 rounded-full border border-indigo-500/40 bg-indigo-950/90 px-4 py-2.5',
          'text-lg font-semibold tabular-nums text-zinc-50 shadow-inner',
          loading && 'animate-pulse text-zinc-500'
        )}
        aria-live="polite"
      >
        {loading ? '…' : fmt(saldoHoje)}
      </div>
      <input
        type="number"
        step="0.01"
        className={cn(fieldClass, 'mt-2')}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={() => onBlurSync?.()}
        aria-label={`${label} — valor editável`}
      />
      <p className="mt-1 text-[10px] text-zinc-500">
        {loading
          ? 'Recalculando contas…'
          : contasCount > 0
            ? `${contasCount} conta${contasCount === 1 ? '' : 's'} · débito + saldo ainda disponível no cartão`
            : usingMock
              ? 'Dados de exemplo (mock) — conecte o Open Finance para saldos reais'
              : 'Sem contas conectadas'}
      </p>
      {hintExtra ? <p className="mt-1 text-[10px] text-purple-400/90">{hintExtra}</p> : null}
    </div>
  );
}

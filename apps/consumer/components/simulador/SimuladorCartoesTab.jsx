'use client';

import Link from 'next/link';
import { ArrowRight, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SimuladorCreditLimitsPanel } from './SimuladorCreditLimitsPanel';
import { SaldoHojeField } from './SaldoHojeField';

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

const EXAMPLES = [
  {
    bank: 'nubank credito',
    limite: 200,
    gastoDashboard: 196,
    disponivel: 4,
  },
  {
    bank: 'bradesco credito',
    limite: 200,
    gastoDashboard: 100,
    disponivel: 100,
  },
];

/**
 * Aba dedicada: limite manual por cartão + gasto do dashboard → saldo de hoje.
 */
export function SimuladorCartoesTab({
  creditCards = [],
  hintsLoading = false,
  hintsHydrated = false,
  saldoHoje = 0,
  contas = [],
  contasCount = 0,
  usingMock = false,
  startingBalance,
  onStartingBalanceChange,
  onStartingBalanceBlur,
  onLimitsChange,
  onLimitsSaved,
  fieldClass,
  labelClass,
}) {
  const debitSum = contas.reduce((acc, c) => acc + (Number(c.saldo_debito) || 0), 0);
  const creditSum = contas.reduce((acc, c) => acc + (Number(c.saldo_cartao_disponivel) || 0), 0);

  return (
    <div className="space-y-3 pb-4">
      <p className="text-[11px] text-zinc-500 leading-relaxed flex gap-2">
        <Info className="h-3.5 w-3.5 text-zinc-600 shrink-0 mt-0.5" aria-hidden />
        <span>
          Informe o <strong className="text-zinc-400 font-medium">limite</strong> de cada cartão. Disponível = limite −
          gasto do dashboard (Open Finance não envia o limite total).
        </span>
      </p>

      <details className="group text-[11px] text-zinc-500">
        <summary className="cursor-pointer text-zinc-400 hover:text-zinc-300 list-none flex items-center gap-1">
          <span className="group-open:hidden">Ver exemplo (nubank credito)</span>
          <span className="hidden group-open:inline">Ocultar exemplo</span>
        </summary>
        <p className="mt-2 pl-0 text-zinc-500 leading-snug">
          Limite {fmt(EXAMPLES[0].limite)}, gasto {fmt(EXAMPLES[0].gastoDashboard)} →{' '}
          <span className="text-emerald-400/90">{fmt(EXAMPLES[0].disponivel)}</span> no saldo de hoje.
        </p>
      </details>

      <SaldoHojeField
        label="Saldo de hoje"
        labelClass={labelClass}
        fieldClass={fieldClass}
        saldoHoje={saldoHoje}
        value={startingBalance}
        loading={hintsLoading && !hintsHydrated}
        contasCount={contasCount}
        usingMock={usingMock}
        onChange={onStartingBalanceChange}
        onBlurSync={onStartingBalanceBlur}
      />

      {contasCount > 0 ? (
        <ul className="text-[11px] divide-y divide-zinc-800/60 border-t border-zinc-800/60 pt-2">
          {contas.map((c) => (
            <li key={c.id} className="flex justify-between gap-2 py-1.5">
              <span className="text-zinc-500 truncate">{c.nome_banco}</span>
              <span className="shrink-0 tabular-nums text-zinc-300">
                {Number(c.saldo_cartao_disponivel) > 0
                  ? `${fmt(c.saldo_cartao_disponivel)} disp.`
                  : fmt(c.saldo_debito)}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-2 pt-2 text-zinc-600">
            <span>à vista</span>
            <span className="tabular-nums">{fmt(debitSum)}</span>
          </li>
          <li className="flex justify-between gap-2 text-zinc-600">
            <span>cartões</span>
            <span className="tabular-nums text-emerald-400/80">{fmt(creditSum)}</span>
          </li>
        </ul>
      ) : null}

      <SimuladorCreditLimitsPanel
        creditCards={creditCards}
        loading={hintsLoading && !hintsHydrated}
        fieldClass={fieldClass}
        labelClass={labelClass}
        onLimitsChange={onLimitsChange}
        onSaved={onLimitsSaved}
      />

      <p className="text-[10px] text-zinc-600 text-center">
        Gastos do cartão vêm do{' '}
        <Link href="/dashboard" className="text-zinc-400 underline underline-offset-2 inline-flex items-center gap-0.5">
          dashboard
          <ArrowRight className="h-3 w-3" />
        </Link>
      </p>
    </div>
  );
}

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
    bank: 'Nubank',
    limite: 200,
    gastoDashboard: 196,
    disponivel: 4,
  },
  {
    bank: 'Bradesco',
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
    <div className="space-y-4 pb-4">
      <CardLike className="border-indigo-500/25 bg-indigo-950/25">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" aria-hidden />
          <div className="text-xs text-zinc-300 leading-relaxed space-y-2">
            <p className="font-semibold text-indigo-200/95">Como funciona</p>
            <p>
              O Open Finance <strong className="text-zinc-100">não traz o limite total</strong> do cartão — só o
              que aparece no dashboard (quanto você já usou). Aqui você informa o{' '}
              <strong className="text-zinc-100">limite de cada banco</strong>; nós subtraímos o gasto do dashboard e
              somamos o que ainda cabe no <strong className="text-[#39FF14]">Saldo de hoje</strong>.
            </p>
            <p className="text-zinc-500 font-mono text-[11px]">
              disponível no cartão = limite que você digitou − gasto no dashboard
            </p>
          </div>
        </div>
      </CardLike>

      <CardLike className="border-zinc-700/80">
        <p className="text-xs font-semibold text-zinc-300 mb-2">Exemplos (ilustrativos)</p>
        <ul className="space-y-2.5">
          {EXAMPLES.map((ex) => (
            <li
              key={ex.bank}
              className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2.5 text-[11px] leading-snug"
            >
              <p className="font-semibold text-purple-300">{ex.bank}</p>
              <p className="text-zinc-400 mt-1">
                Você coloca limite <strong className="text-zinc-200">{fmt(ex.limite)}</strong>. No dashboard
                aparece <strong className="text-zinc-200">{fmt(ex.gastoDashboard)}</strong> já gastos no cartão.
              </p>
              <p className="mt-1 text-zinc-500">
                {fmt(ex.limite)} − {fmt(ex.gastoDashboard)} ={' '}
                <strong className="text-[#39FF14]">{fmt(ex.disponivel)}</strong> entram no Saldo de hoje
                {ex.bank === 'Nubank' ? ' (só mais quatro reais no cartão).' : ' (cem reais ainda no cartão).'}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-zinc-600 mt-2">
          Nos seus cartões reais, os valores vêm do dashboard automaticamente. Quiser mudar o limite, edite abaixo e
          toque em Guardar.
        </p>
      </CardLike>

      <SaldoHojeField
        label="Saldo de hoje (atualizado com seus limites)"
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
        <CardLike className="border-zinc-800/80">
          <p className="text-xs font-semibold text-zinc-300 mb-2">Composição do saldo</p>
          <ul className="space-y-1.5 text-[11px]">
            {contas.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span className="text-zinc-400 truncate">{c.nome_banco}</span>
                <span className="shrink-0 tabular-nums text-zinc-200">
                  {Number(c.saldo_cartao_disponivel) > 0
                    ? `${fmt(c.saldo_cartao_disponivel)} disp.`
                    : fmt(c.saldo_debito)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-2 border-t border-zinc-800 flex justify-between text-[10px] text-zinc-500">
            <span>À vista (débito)</span>
            <span className="tabular-nums text-zinc-400">{fmt(debitSum)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Cartões (disponível)</span>
            <span className="tabular-nums text-[#39FF14]">{fmt(creditSum)}</span>
          </div>
        </CardLike>
      ) : null}

      <SimuladorCreditLimitsPanel
        creditCards={creditCards}
        loading={hintsLoading && !hintsHydrated}
        fieldClass={fieldClass}
        labelClass={labelClass}
        onLimitsChange={onLimitsChange}
        onSaved={onLimitsSaved}
        showFormula
      />

      <p className="text-[11px] text-zinc-500 text-center px-2">
        Gastos do cartão vêm de{' '}
        <Link href="/dashboard" className="text-purple-400 underline underline-offset-2 inline-flex items-center gap-0.5">
          Gastos / dashboard
          <ArrowRight className="h-3 w-3" />
        </Link>
        . Atualize o banco lá; volte aqui para conferir o Saldo de hoje.
      </p>
    </div>
  );
}

function CardLike({ className, children }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4 shadow-[0_0_0_1px_rgba(168,85,247,0.06)]',
        className
      )}
    >
      {children}
    </div>
  );
}

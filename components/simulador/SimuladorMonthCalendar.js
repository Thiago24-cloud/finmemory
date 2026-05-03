'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';

const WEEK_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function formatCompactBrl(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}R$ ${(abs / 1000).toFixed(1)}k`;
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `R$ ${v.toFixed(0)}`;
  }
}

function monthTitle(year, month) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
      new Date(year, month - 1, 1)
    );
  } catch {
    return `${month}/${year}`;
  }
}

/**
 * Calendário mensal compacto — saldo projetado ao fim de cada dia e sinais entrada/saída.
 * @param {{ has: (n: number) => boolean }} [pendingConfirmDays] dias com entrada extra vencida e não confirmada
 */
export function SimuladorMonthCalendar({
  year,
  month,
  daysInMonth,
  points,
  uncertaintyBands = [],
  focusedDay,
  todayDay,
  onSelectDay,
  pendingConfirmDays,
}) {
  const [expanded, setExpanded] = useState(true);

  const dim = Number(daysInMonth) || (points?.length ?? 28);
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || new Date().getMonth() + 1;

  const uncertaintyByDay = (uncertaintyBands || []).reduce((acc, b) => {
    const d = Number(b?.day) || 1;
    const op = Math.max(0, Math.min(1, Number(b?.opacity) || 0));
    acc[d] = Math.max(acc[d] || 0, op);
    return acc;
  }, {});

  const first = new Date(y, m - 1, 1);
  const mondayOffset = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < mondayOffset; i++) {
    cells.push({ type: 'pad', key: `pad-${i}` });
  }
  for (let d = 1; d <= dim; d++) {
    cells.push({ type: 'day', day: d, key: `d-${d}` });
  }

  const pendingSet = pendingConfirmDays;

  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-2 mb-2 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-200 capitalize">{monthTitle(y, m)}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
            Saldo abaixo = <span className="text-zinc-400">projetado ao fim do dia</span> (simulação). Tracejado =
            entrada incerta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-[11px] font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Recolher <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Expandir <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {expanded ? (
        <div className="grid grid-cols-7 gap-1">
          {WEEK_LABELS.map((lb) => (
            <div key={lb} className="text-center text-[10px] font-medium text-zinc-500 py-1">
              {lb}
            </div>
          ))}
          {cells.map((c) => {
            if (c.type === 'pad') {
              return <div key={c.key} className="min-h-[68px]" aria-hidden />;
            }
            const day = c.day;
            const pt = points?.[day - 1];
            const balance = pt?.balance ?? 0;
            const events = pt?.events || [];
            const hasIn = events.some((e) => Number(e?.value) > 0);
            const hasOut = events.some((e) => Number(e?.value) < 0);
            const unc = uncertaintyByDay[day] || 0;
            const lowConfidence = unc >= 0.32;
            const showPendingBadge = pendingSet?.has(day);

            const fullBalance = new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(balance);

            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onSelectDay?.(day)}
                className={cn(
                  'relative flex min-h-[68px] flex-col items-center rounded-lg border px-0.5 py-1 text-center transition-colors',
                  focusedDay === day
                    ? 'border-purple-500 bg-purple-950/50 shadow-[0_0_0_1px_rgba(168,85,247,0.35)]'
                    : 'border-zinc-800/90 bg-zinc-950/60 hover:border-zinc-600',
                  lowConfidence && 'border-dashed border-orange-400/45 opacity-[0.92]',
                  todayDay === day && focusedDay !== day && 'ring-1 ring-purple-500/35'
                )}
              >
                {showPendingBadge ? (
                  <span
                    className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
                    title="Confirmar se o valor extra entrou"
                  />
                ) : null}
                <span className="text-[11px] font-semibold leading-none text-zinc-100">{day}</span>
                <span className="mt-0.5 text-[7px] font-medium uppercase tracking-wide text-zinc-600">Proj.</span>
                <span
                  className={cn(
                    'max-w-full truncate px-0.5 text-[9px] leading-tight font-medium',
                    balance < 0 ? 'text-red-300/95' : 'text-emerald-200/90'
                  )}
                  title={`Saldo projetado ao fim do dia: ${fullBalance}`}
                >
                  {formatCompactBrl(balance)}
                </span>
                <span className="mt-auto flex min-h-[10px] items-center gap-0.5 pt-0.5">
                  {hasIn ? (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/90" title="Entrada" />
                  ) : null}
                  {hasOut ? (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400/90" title="Saída" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950/40 px-3 py-4 text-center text-xs text-zinc-500">
          Calendário recolhido. Toque em <span className="text-zinc-400">Expandir</span> para ver o saldo projetado dia a
          dia.
        </p>
      )}
    </div>
  );
}

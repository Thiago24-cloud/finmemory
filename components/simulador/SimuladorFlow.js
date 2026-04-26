'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, Cloud, HelpCircle, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  buildHeavyBillScheduledOutflows,
  projectSimuladorMonth,
  reliabilityLabel,
} from '../../lib/simuladorProjection';
import { SimuladorRadarChart } from './SimuladorRadarChart';

const STORAGE_KEY = 'finmemory-simulador-v1';

const defaultState = () => ({
  step: 1,
  hasSupport: false,
  contacts: [],
  extraEnabled: true,
  extraLabel: '',
  extraAmount: 500,
  extraDay: 18,
  extraReliabilityPct: 75,
  extraCommitted: false,
  creditDueDay: 10,
  bestPurchaseDay: 25,
  reliefPct: 40,
  startingBalance: 1200,
  dailyBurn: 65,
  dailyBurnAuto: true,
  salaryDay: 5,
  salaryAmount: 3200,
  heavyBillDay: 10,
  heavyBillAmount: 950,
  stressMode: false,
});

function loadState() {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function daysInCurrentMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function Card({ className, children }) {
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

export function SimuladorFlow() {
  const { status } = useSession();
  const [state, setState] = useState(defaultState);
  const [mounted, setMounted] = useState(false);
  const [focusedDay, setFocusedDay] = useState(null);
  const [hints, setHints] = useState(null);
  const [hintsLoading, setHintsLoading] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const lastSentRef = useRef('');

  const fetchHints = useCallback(async () => {
    if (status !== 'authenticated') return;
    setHintsLoading(true);
    try {
      const res = await fetch('/api/simulador/hints', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) setHints(json);
    } catch {
      /* ignore */
    } finally {
      setHintsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'loading') return undefined;

    if (status !== 'authenticated') {
      setState(loadState());
      setMounted(true);
      setRemoteReady(true);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const [stateRes, hintsRes] = await Promise.all([
          fetch('/api/simulador/state', { credentials: 'include' }),
          fetch('/api/simulador/hints', { credentials: 'include' }),
        ]);
        const stateJson = await stateRes.json().catch(() => ({}));
        const hintsJson = await hintsRes.json().catch(() => ({}));

        if (cancelled) return;

        if (hintsJson?.ok) setHints(hintsJson);

        if (stateJson?.state && typeof stateJson.state === 'object') {
          const merged = { ...defaultState(), ...stateJson.state };
          setState(merged);
          lastSentRef.current = JSON.stringify(merged);
          setSaveStatus('saved');
        } else {
          const local = loadState();
          setState(local);
          lastSentRef.current = JSON.stringify(local);
        }
      } catch {
        if (!cancelled) {
          const local = loadState();
          setState(local);
          lastSentRef.current = JSON.stringify(local);
        }
      } finally {
        if (!cancelled) {
          setMounted(true);
          setRemoteReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, mounted]);

  useEffect(() => {
    if (!remoteReady || status !== 'authenticated') return;
    const serialized = JSON.stringify(state);
    const t = setTimeout(async () => {
      if (serialized === lastSentRef.current) return;
      try {
        setSaveStatus('saving');
        const res = await fetch('/api/simulador/state', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state }),
        });
        if (res.ok) {
          lastSentRef.current = serialized;
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      }
    }, 900);
    return () => clearTimeout(t);
  }, [state, remoteReady, status]);

  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchHints();
    };
    window.addEventListener('focus', fetchHints);
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') fetchHints();
    }, 60000);
    return () => {
      window.removeEventListener('focus', fetchHints);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, [status, fetchHints]);

  useEffect(() => {
    if (!hints) return;
    setState((s) => {
      if (!s.dailyBurnAuto) return s;
      const suggested =
        hints.dailyBurnReal28d > 0
          ? hints.dailyBurnReal28d
          : hints.dailyBurnHint > 0
            ? hints.dailyBurnHint
            : 0;
      if (!(suggested > 0)) return s;
      if (Math.abs((Number(s.dailyBurn) || 0) - suggested) < 0.01) return s;
      return { ...s, dailyBurn: suggested };
    });
  }, [hints]);

  const set = useCallback((patch) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const applyOpenFinanceHints = useCallback(() => {
    if (!hints) return;
    const card = hints.manualCards?.[0];
    setState((s) => ({
      ...s,
      startingBalance:
        typeof hints.accountBalanceTotal === 'number'
          ? Math.round(hints.accountBalanceTotal * 100) / 100
          : s.startingBalance,
      salaryAmount:
        hints.month?.incomeTotal > 0 ? hints.month.incomeTotal : s.salaryAmount,
      salaryDay:
        typeof hints.salaryDayHint === 'number' && hints.salaryDayHint >= 1 && hints.salaryDayHint <= 31
          ? hints.salaryDayHint
          : s.salaryDay,
      dailyBurn:
        hints.dailyBurnReal28d > 0
          ? hints.dailyBurnReal28d
          : hints.dailyBurnHint > 0
            ? hints.dailyBurnHint
            : s.dailyBurn,
      dailyBurnAuto: true,
      creditDueDay:
        typeof card?.due_day === 'number' && card.due_day >= 1 && card.due_day <= 31 ? card.due_day : s.creditDueDay,
      bestPurchaseDay:
        typeof card?.closing_day === 'number' && card.closing_day >= 1 && card.closing_day <= 31
          ? card.closing_day
          : s.bestPurchaseDay,
    }));
  }, [hints]);

  const dim = useMemo(() => daysInCurrentMonth(), []);
  const todayDay = useMemo(() => new Date().getDate(), []);
  const committedExtraValue = useMemo(
    () => (state.extraEnabled && state.extraCommitted ? Math.max(0, Number(state.extraAmount) || 0) : 0),
    [state.extraEnabled, state.extraCommitted, state.extraAmount]
  );
  const adjustedStartingBalance = useMemo(
    () => Math.max(0, (Number(state.startingBalance) || 0) - committedExtraValue),
    [state.startingBalance, committedExtraValue]
  );

  const projection = useMemo(() => {
    const supportInflows = state.hasSupport
      ? state.contacts
          .filter((c) => c.name?.trim() && Number(c.amount) > 0)
          .map((c) => ({
            name: c.name.trim(),
            day: Number(c.day) || 1,
            amount: Number(c.amount) || 0,
            reliability: Number(c.reliability) || 0,
          }))
      : [];

    const extraInflows =
      state.extraEnabled && Number(state.extraAmount) > 0
        ? [
            {
              label: state.extraLabel?.trim() || 'Entrada extra',
              day: Number(state.extraDay) || 1,
              amount: Number(state.extraAmount) || 0,
              reliability: (Number(state.extraReliabilityPct) || 0) / 100,
            },
          ]
        : [];

    const scheduledOutflows = buildHeavyBillScheduledOutflows({
      heavyBillAmount: Number(state.heavyBillAmount) || 0,
      heavyBillDay: Number(state.heavyBillDay) || 1,
      creditDueDay: Number(state.creditDueDay) || 10,
      deferralPct: Number(state.reliefPct) || 0,
      daysInMonth: dim,
    });

    return projectSimuladorMonth({
      startingBalance: adjustedStartingBalance,
      dailyBurn: Number(state.dailyBurn) || 0,
      salaryDay: Number(state.salaryDay) > 0 ? Number(state.salaryDay) : null,
      salaryAmount: Number(state.salaryAmount) || 0,
      supportInflows,
      extraInflows: state.extraCommitted ? [] : extraInflows,
      scheduledOutflows,
      stressMode: state.stressMode,
    });
  }, [state, dim, adjustedStartingBalance]);

  const salaryProjection = useMemo(() => {
    const salaryDay = Math.min(31, Math.max(1, Number(state.salaryDay) || 1));
    const currentDay = Math.min(31, Math.max(1, todayDay || 1));
    const daysRemaining = salaryDay >= currentDay ? salaryDay - currentDay : 31 - currentDay + salaryDay;
    const burn = Math.max(0, Number(state.dailyBurn) || 0);
    const projectionOut = daysRemaining * burn;
    const salary = Math.max(0, Number(state.salaryAmount) || 0);
    const saldoFinalEsperado = adjustedStartingBalance - projectionOut + salary;
    return {
      daysRemaining,
      burn,
      projectionOut,
      saldoFinalEsperado: Math.round(saldoFinalEsperado * 100) / 100,
      salaryDay,
    };
  }, [state.salaryDay, state.salaryAmount, state.dailyBurn, adjustedStartingBalance, todayDay]);

  const entradasConfirmadas = useMemo(() => {
    const salary = Math.max(0, Number(state.salaryAmount) || 0);
    const support = state.hasSupport
      ? state.contacts.reduce((acc, c) => {
          const rel = Number(c.reliability) || 0;
          const amount = Math.max(0, Number(c.amount) || 0);
          if (rel < 0.85 || amount <= 0) return acc;
          return acc + amount * rel;
        }, 0)
      : 0;
    const extra =
      state.extraEnabled && !state.extraCommitted && Number(state.extraAmount) > 0 && Number(state.extraReliabilityPct) >= 85
        ? Number(state.extraAmount) * (Number(state.extraReliabilityPct) / 100)
        : 0;
    return Math.round((salary + support + extra) * 100) / 100;
  }, [state]);

  const metaDiariaSugerida = useMemo(() => {
    const dias = Math.max(1, salaryProjection.daysRemaining);
    return Math.round(((adjustedStartingBalance + entradasConfirmadas) / dias) * 100) / 100;
  }, [salaryProjection.daysRemaining, adjustedStartingBalance, entradasConfirmadas]);

  const deferredToCardDisplay = useMemo(() => {
    const heavy = Number(state.heavyBillAmount) || 0;
    const d = (Number(state.reliefPct) || 0) / 100;
    return heavy * d;
  }, [state.reliefPct, state.heavyBillAmount]);

  const addContact = () => {
    setState((s) => ({
      ...s,
      contacts: [...s.contacts, { id: String(Date.now()), name: '', day: 20, amount: 0, reliability: 0.6 }],
    }));
  };

  const updateContact = (id, patch) => {
    setState((s) => ({
      ...s,
      contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const removeContact = (id) => {
    setState((s) => {
      const next = s.contacts.filter((c) => c.id !== id);
      if (next.length === 0 && s.hasSupport) {
        return {
          ...s,
          contacts: [{ id: String(Date.now()), name: '', day: 20, amount: 0, reliability: 0.6 }],
        };
      }
      return { ...s, contacts: next };
    });
  };

  const steps = 4;
  const canNext =
    state.step < steps &&
    (state.step !== 1 ||
      !state.hasSupport ||
      state.contacts.some((c) => c.name?.trim() && Number(c.amount) > 0));

  const goNext = () => {
    if (state.step < steps) set({ step: state.step + 1 });
  };
  const goPrev = () => {
    if (state.step > 1) set({ step: state.step - 1 });
  };

  const fieldClass =
    'w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50';

  const labelClass = 'text-xs font-medium text-zinc-400 mb-1 block';

  const dayRow = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Saldo hoje (conta)</label>
          <input
            type="number"
            min={0}
            className={fieldClass}
            value={state.startingBalance}
            onChange={(e) => set({ startingBalance: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className={labelClass}>Gasto médio / dia</label>
          <input
            type="number"
            min={0}
            className={fieldClass}
            value={state.dailyBurn}
            onChange={(e) => set({ dailyBurn: Number(e.target.value), dailyBurnAuto: false })}
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[10px] text-zinc-500">
              Base real (28d):{' '}
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                hints?.dailyBurnReal28d || 0
              )}
            </p>
            <button
              type="button"
              onClick={() =>
                set({
                  dailyBurn:
                    hints?.dailyBurnReal28d > 0
                      ? hints.dailyBurnReal28d
                      : hints?.dailyBurnHint > 0
                        ? hints.dailyBurnHint
                        : state.dailyBurn,
                  dailyBurnAuto: true,
                })
              }
              className="text-[10px] font-medium text-purple-300 underline underline-offset-2"
            >
              usar cálculo real
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className={labelClass}>Dia do salário</label>
          <input
            type="number"
            min={1}
            max={31}
            className={fieldClass}
            value={state.salaryDay}
            onChange={(e) => set({ salaryDay: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className={labelClass}>Valor salário</label>
          <input
            type="number"
            min={0}
            className={fieldClass}
            value={state.salaryAmount}
            onChange={(e) => set({ salaryAmount: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-purple-500/20 bg-purple-950/20 px-3 py-2.5">
        <p className="text-xs text-zinc-300">
          Com seu gasto atual de{' '}
          <strong className="text-purple-300">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              salaryProjection.burn
            )}
            /dia
          </strong>
          , você chegará ao dia do salário com{' '}
          <strong className={salaryProjection.saldoFinalEsperado < 0 ? 'text-red-300' : 'text-emerald-300'}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              salaryProjection.saldoFinalEsperado
            )}
          </strong>
          .
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          Meta diária sugerida para sobreviver sem entrar no vermelho:{' '}
          <strong className="text-zinc-200">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metaDiariaSugerida)}
            /dia
          </strong>{' '}
          (entradas confirmadas: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entradasConfirmadas)}).
        </p>
        {committedExtraValue > 0 ? (
          <p className="mt-1 text-[11px] text-amber-300">
            Ajuste aplicado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(committedExtraValue)} retirados do saldo por estar comprometido.
          </p>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 pb-28 pt-safe">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-zinc-800/80 bg-zinc-950/90 px-3 py-3 backdrop-blur-md">
        <div className="flex items-center gap-1 min-w-0">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
            aria-label="Voltar ao painel"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-400/90 truncate">
            Simulador
          </span>
        </div>
        <div className="flex items-center gap-1 text-zinc-500" aria-hidden>
          <HelpCircle className="h-5 w-5" />
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <div className="flex gap-1.5">
          {Array.from({ length: steps }, (_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i + 1 <= state.step ? 'bg-purple-500' : 'bg-zinc-800'
              )}
            />
          ))}
        </div>

        <Card className="border-purple-500/15 bg-zinc-900/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400 min-w-0">
              <Cloud className="h-4 w-4 text-purple-400 shrink-0" />
              {status !== 'authenticated' ? (
                <span>Inicie sessão para guardar o simulador na sua conta.</span>
              ) : saveStatus === 'saving' ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> A guardar…
                </span>
              ) : saveStatus === 'error' ? (
                <span className="text-amber-400">Não foi possível guardar. Verifique a ligação.</span>
              ) : (
                <span className="text-zinc-500">Simulador sincronizado com a conta.</span>
              )}
            </div>
          </div>
          {hints?.hasOpenFinance && (
            <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2">
              <p className="text-[11px] text-zinc-500 leading-snug">
                Soma das contas conectadas:{' '}
                <strong className="text-zinc-200">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    hints.accountBalanceTotal || 0
                  )}
                </strong>
                . Burn rate real (28d):{' '}
                <strong className="text-zinc-200">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    hints.dailyBurnReal28d || hints.dailyBurnHint || 0
                  )}
                  /dia
                </strong>
                .
              </p>
              {hints?.burnRateBreakdown ? (
                <p className="text-[10px] text-zinc-600">
                  28 dias · Open Finance{' '}
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    hints.burnRateBreakdown.openFinanceDebits || 0
                  )}{' '}
                  + OCR/Manual{' '}
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    hints.burnRateBreakdown.ocrManualDebits || 0
                  )}
                  .
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyOpenFinanceHints}
                  className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors"
                >
                  Preencher com dados reais
                </button>
                <button
                  type="button"
                  onClick={() => fetchHints()}
                  disabled={hintsLoading}
                  className="inline-flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl text-xs font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', hintsLoading && 'animate-spin')} />
                  Atualizar
                </button>
              </div>
            </div>
          )}
          {hints && !hints.hasOpenFinance && status === 'authenticated' && (
            <p className="mt-3 text-[11px] text-zinc-500">
              Ligue uma conta em{' '}
              <Link href="/dashboard" className="text-purple-400 underline underline-offset-2">
                Gastos
              </Link>{' '}
              para sugerir saldo e entradas do mês.
            </p>
          )}
        </Card>

        {state.step === 1 && (
          <>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Em caso de aperto, você tem alguém a quem pedir ajuda? Mapeie <span className="text-purple-300">quem</span>,{' '}
              <span className="text-purple-300">quando</span> costuma rolar um Pix e o <span className="text-purple-300">valor</span>{' '}
              médio — assim o radar mostra se seu mês depende de terceiros.
            </p>
            <Card>
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-sm font-semibold text-zinc-200">Rede de apoio</span>
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    className="accent-purple-500"
                    checked={state.hasSupport}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setState((s) => ({
                        ...s,
                        hasSupport: v,
                        contacts:
                          v && s.contacts.length === 0
                            ? [{ id: String(Date.now()), name: '', day: 20, amount: 150, reliability: 0.75 }]
                            : s.contacts,
                      }));
                    }}
                  />
                  Tenho contatos
                </label>
              </div>
              {state.hasSupport && (
                <div className="space-y-4">
                  {state.contacts.map((c) => (
                    <div key={c.id} className="rounded-xl border border-zinc-800 bg-black/30 p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-zinc-500">Contato</span>
                        {state.contacts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeContact(c.id)}
                            className="text-zinc-600 hover:text-red-400 p-1"
                            aria-label="Remover contato"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <input
                        className={fieldClass}
                        placeholder="Nome (ex.: meu irmão)"
                        value={c.name}
                        onChange={(e) => updateContact(c.id, { name: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelClass}>Dia típico</label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            className={fieldClass}
                            value={c.day}
                            onChange={(e) => updateContact(c.id, { day: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Valor (R$)</label>
                          <input
                            type="number"
                            min={0}
                            className={fieldClass}
                            value={c.amount}
                            onChange={(e) => updateContact(c.id, { amount: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-zinc-500 mb-1">
                          <span>Confiabilidade da entrada</span>
                          <span className="text-purple-300">{Math.round((c.reliability || 0) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round((c.reliability || 0) * 100)}
                          onChange={(e) => updateContact(c.id, { reliability: Number(e.target.value) / 100 })}
                          className="w-full accent-purple-500"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addContact}
                    className="w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400 hover:border-purple-500/50 hover:text-purple-200 transition-colors"
                  >
                    + Adicionar contato
                  </button>
                </div>
              )}
            </Card>
            {dayRow}
          </>
        )}

        {state.step === 2 && (
          <>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Bônus, freela ou Pix extra? Informe a <span className="text-purple-300">fonte</span>, o valor e a{' '}
              <span className="text-purple-300">confiabilidade</span>. Se você já “gastou” esse dinheiro na cabeça, marque
              abaixo — o simulador ignora a entrada (evita ilusão de caixa).
            </p>
            <Card>
              <label className="flex items-center gap-2 text-sm text-zinc-300 mb-3">
                <input
                  type="checkbox"
                  className="accent-purple-500"
                  checked={state.extraEnabled}
                  onChange={(e) => set({ extraEnabled: e.target.checked })}
                />
              Entrada extra neste mês
              </label>
              {state.extraEnabled && (
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Fonte</label>
                    <input
                      className={fieldClass}
                      placeholder="Ex.: freela designer"
                      value={state.extraLabel}
                      onChange={(e) => set({ extraLabel: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Valor (R$)</label>
                      <input
                        type="number"
                        min={0}
                        className={fieldClass}
                        value={state.extraAmount}
                        onChange={(e) => set({ extraAmount: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Dia provável</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className={fieldClass}
                        value={state.extraDay}
                        onChange={(e) => set({ extraDay: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Confiabilidade</span>
                      <span className="text-purple-300">
                        {state.extraReliabilityPct}% · {reliabilityLabel(state.extraReliabilityPct)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={state.extraReliabilityPct}
                      onChange={(e) => set({ extraReliabilityPct: Number(e.target.value) })}
                      className="w-full accent-purple-500"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-zinc-400 leading-snug">
                    <input
                      type="checkbox"
                      className="accent-purple-500 mt-0.5"
                      checked={state.extraCommitted}
                      onChange={(e) => set({ extraCommitted: e.target.checked })}
                    />
                    Já comprometi esse valor (cartão, parcela, compra) — tratar como se não fosse entrar
                  </label>
                </div>
              )}
            </Card>
            {dayRow}
          </>
        )}

        {state.step === 3 && (
          <>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Crédito não é só limite: é <span className="text-purple-300">calendário</span>. Parte da conta pesada pode
              ir para o <span className="text-purple-300">dia do vencimento da fatura</span> — o gráfico mostra o efeito no
              saldo ao longo do mês (educativo; não substitui regras do banco).
            </p>
            <Card>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Dia vencimento fatura</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className={fieldClass}
                    value={state.creditDueDay}
                    onChange={(e) => set({ creditDueDay: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Fecho da fatura (referência)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className={fieldClass}
                    value={state.bestPurchaseDay}
                    onChange={(e) => set({ bestPurchaseDay: Number(e.target.value) })}
                  />
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                O simulador reparte a conta pesada: à vista no dia da conta e o restante no vencimento do cartão, quando
                os dias são diferentes.
              </p>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                  <span>% da conta pesada no cartão (vencimento)</span>
                  <span className="text-purple-300">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      deferredToCardDisplay
                    )}{' '}
                    · dia {state.creditDueDay}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={state.reliefPct}
                  onChange={(e) => set({ reliefPct: Number(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>
            </Card>
            <Card>
              <span className="text-sm font-semibold text-zinc-200">Conta pesada no mês</span>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className={labelClass}>Dia</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className={fieldClass}
                    value={state.heavyBillDay}
                    onChange={(e) => set({ heavyBillDay: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Valor (R$)</label>
                  <input
                    type="number"
                    min={0}
                    className={fieldClass}
                    value={state.heavyBillAmount}
                    onChange={(e) => set({ heavyBillAmount: Number(e.target.value) })}
                  />
                </div>
              </div>
            </Card>
            {dayRow}
          </>
        )}

        {state.step === 4 && (
          <>
            <div className="rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-950/40 to-zinc-950 p-4">
              <p className="text-xs uppercase tracking-widest text-purple-300/90">Saldo final previsto</p>
              <p className="text-2xl font-semibold text-white mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(projection.finalBalance)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Mínimo no mês: dia {projection.minDay} ·{' '}
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(projection.minBalance)}
              </p>
            </div>

            <Card className="border-purple-500/20">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-semibold text-zinc-200">Radar de saldo</span>
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    className="accent-purple-500"
                    checked={state.stressMode}
                    onChange={(e) => set({ stressMode: e.target.checked })}
                  />
                  E se não cair?
                </label>
              </div>
              <SimuladorRadarChart
                points={projection.points}
                gaps={projection.gaps}
                stressMode={state.stressMode}
                onDayFocus={setFocusedDay}
              />
            </Card>

            {focusedDay != null && (
              <Card className="border-zinc-700">
                <span className="text-xs text-zinc-500">Dia {focusedDay}</span>
                <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                  {(projection.points.find((p) => p.day === focusedDay)?.events || []).map((ev, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="text-zinc-400 truncate">{ev.label}</span>
                      <span className={ev.value < 0 ? 'text-red-300' : 'text-emerald-300'}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ev.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <p className="text-[11px] text-zinc-500 leading-relaxed px-1">
              Isso é uma simulação educativa: não substitui extrato nem acordo com banco. Use para decidir se vale postergar,
              pedir apoio com antecedência ou cortar gasto antes do “vale da morte” no meio do mês.
            </p>
          </>
        )}
      </div>

      <div className="fixed bottom-[4.75rem] left-0 right-0 z-40 px-4 max-w-md mx-auto flex gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={state.step <= 1}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 py-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 text-sm font-medium text-zinc-200',
            state.step <= 1 && 'opacity-40 pointer-events-none'
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </button>
        {state.step < steps ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            className={cn(
              'flex-[1.35] flex items-center justify-center gap-1 py-3 rounded-2xl text-sm font-semibold text-white',
              'bg-gradient-to-r from-purple-600 to-fuchsia-600 shadow-lg shadow-purple-900/40',
              !canNext && 'opacity-50 pointer-events-none'
            )}
          >
            Continuar
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => set({ step: 1 })}
            className="flex-[1.35] py-3 rounded-2xl text-sm font-semibold text-white bg-zinc-800 border border-zinc-700"
          >
            Recomeçar passos
          </button>
        )}
      </div>
    </div>
  );
}

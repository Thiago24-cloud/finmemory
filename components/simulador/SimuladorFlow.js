'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  HelpCircle,
  Home,
  Loader2,
  Palmtree,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Drawer } from 'vaul';
import { cn } from '../../lib/utils';
import { getSupabase } from '../../lib/supabase';
import {
  buildHeavyBillScheduledOutflows,
  projectSimuladorMonth,
  reliabilityLabel,
} from '../../lib/simuladorProjection';
import { SimuladorMonthCalendar } from './SimuladorMonthCalendar';
import { NEED, SimuladorNecessityPie } from './SimuladorNecessityPie';
import { SimuladorRadarChart } from './SimuladorRadarChart';

const STORAGE_KEY = 'finmemory-simulador-v1';

function newExtraRowId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `extra-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clampDayOfMonth(day, dim) {
  const d = Number(day) || 1;
  return Math.min(dim, Math.max(1, d));
}

function monthKeyNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeNecessity(v) {
  return v === 'leisure' || v === 'investment' ? v : 'essential';
}

function normalizeSimuladorState(parsed) {
  const dim = daysInCurrentMonth();
  const parsedRows = parsed && Array.isArray(parsed.extraRows) ? parsed.extraRows : [];
  const hasLegacyExtraFields =
    parsed &&
    parsedRows.length === 0 &&
    (parsed.extraLabel !== undefined ||
      parsed.extraAmount !== undefined ||
      parsed.extraDay !== undefined ||
      parsed.extraReliabilityPct !== undefined ||
      parsed.extraCommitted !== undefined);

  const merged = { ...defaultState(), ...parsed };

  if (hasLegacyExtraFields) {
    merged.extraRows = [
      {
        id: newExtraRowId(),
        label: typeof merged.extraLabel === 'string' ? merged.extraLabel : '',
        amount:
          merged.extraAmount !== undefined && merged.extraAmount !== ''
            ? Number(merged.extraAmount)
            : 500,
        day: clampDayOfMonth(merged.extraDay ?? 18, dim),
        reliabilityPct:
          Number(merged.extraReliabilityPct) >= 0 && Number(merged.extraReliabilityPct) <= 100
            ? Number(merged.extraReliabilityPct)
            : 75,
        committed: Boolean(merged.extraCommitted),
        necessity: 'essential',
        receivedConfirmed: false,
      },
    ];
  } else if (!Array.isArray(merged.extraRows) || merged.extraRows.length === 0) {
    merged.extraRows = [
      {
        id: newExtraRowId(),
        label: '',
        amount: 500,
        day: clampDayOfMonth(18, dim),
        reliabilityPct: 75,
        committed: false,
        necessity: 'essential',
        receivedConfirmed: false,
      },
    ];
  } else {
    merged.extraRows = merged.extraRows.map((r, i) => ({
      id: r.id || `extra-${i}-${Date.now()}`,
      label: typeof r.label === 'string' ? r.label : '',
      amount: Math.max(0, Number(r.amount) || 0),
      day: clampDayOfMonth(r.day ?? 1, dim),
      reliabilityPct: Math.min(100, Math.max(0, Number(r.reliabilityPct) ?? 75)),
      committed: Boolean(r.committed),
      necessity: normalizeNecessity(r.necessity),
      receivedConfirmed: Boolean(r.receivedConfirmed),
    }));
  }

  const mk = monthKeyNow();
  if (merged.simuladorMonthKey != null && merged.simuladorMonthKey !== mk) {
    merged.extraRows = (merged.extraRows || []).map((r) => ({
      ...r,
      receivedConfirmed: false,
    }));
  }
  merged.simuladorMonthKey = mk;

  return merged;
}

const defaultState = () => ({
  step: 1,
  hasSupport: false,
  contacts: [],
  extraEnabled: true,
  simuladorMonthKey: monthKeyNow(),
  extraRows: [
    {
      id: newExtraRowId(),
      label: '',
      amount: 500,
      day: clampDayOfMonth(18, daysInCurrentMonth()),
      reliabilityPct: 75,
      committed: false,
      necessity: 'essential',
      receivedConfirmed: false,
    },
  ],
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
    return normalizeSimuladorState(parsed);
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
  const { data: session, status } = useSession();
  const [state, setState] = useState(defaultState);
  const [mounted, setMounted] = useState(false);
  const [focusedDay, setFocusedDay] = useState(null);
  const [hints, setHints] = useState(null);
  const [hintsLoading, setHintsLoading] = useState(false);
  const [burnAuditOpen, setBurnAuditOpen] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const lastSentRef = useRef('');
  const [debouncedState, setDebouncedState] = useState(state);

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
          const merged = normalizeSimuladorState(stateJson.state);
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
    const t = setTimeout(() => setDebouncedState(state), 220);
    return () => clearTimeout(t);
  }, [state]);

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
    }, 15000);
    return () => {
      window.removeEventListener('focus', fetchHints);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, [status, fetchHints]);

  /** Realtime (quando ativo no projeto Supabase) + polling 15s — hints alinham após nova despesa. */
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.supabaseId) return undefined;
    const sb = getSupabase();
    if (!sb) return undefined;
    const uid = session.user.supabaseId;
    const ch = sb
      .channel(`finmem-simulador-hints-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bank_transactions', filter: `user_id=eq.${uid}` },
        () => {
          fetchHints();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transacoes', filter: `user_id=eq.${uid}` },
        () => {
          fetchHints();
        }
      )
      .subscribe();
    return () => {
      try {
        sb.removeChannel(ch);
      } catch {
        /* ignore */
      }
    };
  }, [status, session?.user?.supabaseId, fetchHints]);

  useEffect(() => {
    if (state.step !== 4) setFocusedDay(null);
  }, [state.step]);

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
  const committedExtraValue = useMemo(() => {
    if (!state.extraEnabled) return 0;
    return (state.extraRows || []).reduce((acc, r) => {
      if (!r.committed) return acc;
      return acc + Math.max(0, Number(r.amount) || 0);
    }, 0);
  }, [state.extraEnabled, state.extraRows]);
  const adjustedStartingBalance = useMemo(
    () => (Number(state.startingBalance) || 0) - committedExtraValue,
    [state.startingBalance, committedExtraValue]
  );

  const projection = useMemo(() => {
    const supportInflows = debouncedState.hasSupport
      ? debouncedState.contacts
          .filter((c) => c.name?.trim() && Number(c.amount) > 0)
          .map((c) => ({
            name: c.name.trim(),
            day: Number(c.day) || 1,
            amount: Number(c.amount) || 0,
            reliability: Number(c.reliability) || 0,
          }))
      : [];

    const extraInflows =
      debouncedState.extraEnabled
        ? (debouncedState.extraRows || [])
            .filter((r) => !r.committed && Number(r.amount) > 0)
            .map((r) => ({
              label: r.label?.trim() || 'Entrada extra',
              day: clampDayOfMonth(r.day, dim),
              amount: Number(r.amount) || 0,
              reliability: (Number(r.reliabilityPct) || 0) / 100,
              necessity: normalizeNecessity(r.necessity),
            }))
        : [];

    const scheduledOutflows = buildHeavyBillScheduledOutflows({
      heavyBillAmount: Number(debouncedState.heavyBillAmount) || 0,
      heavyBillDay: Number(debouncedState.heavyBillDay) || 1,
      creditDueDay: Number(debouncedState.creditDueDay) || 10,
      deferralPct: Number(debouncedState.reliefPct) || 0,
      daysInMonth: dim,
    });

    return projectSimuladorMonth({
      startingBalance: adjustedStartingBalance,
      dailyBurn: Number(debouncedState.dailyBurn) || 0,
      salaryDay: Number(debouncedState.salaryDay) > 0 ? Number(debouncedState.salaryDay) : null,
      salaryAmount: Number(debouncedState.salaryAmount) || 0,
      supportInflows,
      extraInflows,
      scheduledOutflows,
      stressMode: debouncedState.stressMode,
      variableIncomeShockPct: debouncedState.stressMode ? 30 : 0,
    });
  }, [debouncedState, dim, adjustedStartingBalance]);
  const uncertaintyBands = useMemo(() => {
    const bands = [];
    if (debouncedState.hasSupport) {
      for (const c of debouncedState.contacts || []) {
        const rel = Number(c?.reliability) || 0;
        if (!(Number(c?.amount) > 0)) continue;
        bands.push({
          day: Number(c?.day) || 1,
          opacity: rel >= 0.9 ? 0.12 : rel >= 0.6 ? 0.26 : 0.44,
        });
      }
    }
    if (debouncedState.extraEnabled) {
      for (const r of debouncedState.extraRows || []) {
        if (r.committed || !(Number(r.amount) > 0)) continue;
        const rel = (Number(r.reliabilityPct) || 0) / 100;
        bands.push({
          day: clampDayOfMonth(r.day, dim),
          opacity: rel >= 0.9 ? 0.12 : rel >= 0.6 ? 0.26 : 0.44,
        });
      }
    }
    return bands;
  }, [debouncedState, dim]);
  const baselineMonthlyExpense = useMemo(() => Number(hints?.baseline?.avgExpenseLast3Months) || 0, [hints]);

  const necessityBuckets = useMemo(() => {
    if (!state.extraEnabled) return { essential: 0, leisure: 0, investment: 0 };
    return (state.extraRows || []).reduce(
      (acc, r) => {
        if (r.committed || !(Number(r.amount) > 0)) return acc;
        acc[normalizeNecessity(r.necessity)] += Number(r.amount) || 0;
        return acc;
      },
      { essential: 0, leisure: 0, investment: 0 }
    );
  }, [state.extraEnabled, state.extraRows]);

  /** Um único memo evita cadeia projection → pending → confirm; propriedades lidas após o memo (evita TDZ com nomes minificados). */
  const pendingExtrasPack = useMemo(() => {
    const monthDim = projection.daysInMonth;
    if (!state.extraEnabled) {
      return {
        pendingExtraRows: [],
        pendingConfirmDays: new Set(),
        focusedDayPendingExtras: [],
      };
    }
    const rows = (state.extraRows || []).filter((r) => {
      if (r.committed || !(Number(r.amount) > 0) || r.receivedConfirmed) return false;
      const d = clampDayOfMonth(r.day, monthDim);
      return todayDay > d;
    });
    const pendingDays = new Set();
    for (const r of rows) {
      pendingDays.add(clampDayOfMonth(r.day, monthDim));
    }
    const focusedPending =
      focusedDay == null ? [] : rows.filter((r) => clampDayOfMonth(r.day, monthDim) === focusedDay);
    return {
      pendingExtraRows: rows,
      pendingConfirmDays: pendingDays,
      focusedDayPendingExtras: focusedPending,
    };
  }, [state.extraEnabled, state.extraRows, projection, todayDay, focusedDay]);
  const pendingExtraRows = pendingExtrasPack.pendingExtraRows;
  const pendingConfirmDays = pendingExtrasPack.pendingConfirmDays;
  const focusedDayPendingExtras = pendingExtrasPack.focusedDayPendingExtras;

  const salaryProjection = useMemo(() => {
    const salaryDay = Math.min(31, Math.max(1, Number(state.salaryDay) || 1));
    const currentDay = Math.min(31, Math.max(1, todayDay || 1));
    const daysRemaining = salaryDay >= currentDay ? salaryDay - currentDay : 31 - currentDay + salaryDay;
    const burn = Math.max(0, Number(state.dailyBurn) || 0);
    const burnUntilSalary = daysRemaining * burn;
    const salary = Math.max(0, Number(state.salaryAmount) || 0);
    const saldoFinalEsperado = adjustedStartingBalance - burnUntilSalary + salary;
    return {
      daysRemaining,
      burn,
      projectionOut: burnUntilSalary,
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
    const extra = state.extraEnabled
      ? (state.extraRows || []).reduce((acc, r) => {
          if (r.committed || Number(r.amount) <= 0 || Number(r.reliabilityPct) < 85) return acc;
          return acc + Number(r.amount) * (Number(r.reliabilityPct) / 100);
        }, 0)
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

  const addExtraRow = () => {
    setState((s) => ({
      ...s,
      extraRows: [
        ...(s.extraRows || []),
        {
          id: newExtraRowId(),
          label: '',
          amount: 0,
          day: clampDayOfMonth(18, dim),
          reliabilityPct: 75,
          committed: false,
          necessity: 'essential',
          receivedConfirmed: false,
        },
      ],
    }));
  };

  const updateExtraRow = (id, patch) => {
    setState((s) => ({
      ...s,
      extraRows: (s.extraRows || []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const removeExtraRow = (id) => {
    setState((s) => {
      const next = (s.extraRows || []).filter((r) => r.id !== id);
      return {
        ...s,
        extraRows:
          next.length > 0
            ? next
            : [
                {
                  id: newExtraRowId(),
                  label: '',
                  amount: 0,
                  day: clampDayOfMonth(18, dim),
                  reliabilityPct: 75,
                  committed: false,
                  necessity: 'essential',
                  receivedConfirmed: false,
                },
              ],
      };
    });
  };

  const setReliabilityByConfidence = useCallback((id, confidence) => {
    const map = {
      certo: 0.95,
      provavel: 0.75,
      incerto: 0.4,
    };
    updateContact(id, { reliability: map[confidence] ?? 0.75 });
  }, []);

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
          <label className={labelClass}>Saldo hoje (poder de compra sugerido)</label>
          <input
            type="number"
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
              className="text-[10px] font-medium text-[#39FF14] underline underline-offset-2 hover:text-[#5cff3d]"
            >
              usar cálculo real
            </button>
          </div>
          <button
            type="button"
            onClick={() => setBurnAuditOpen((o) => !o)}
            className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-700/90 bg-zinc-950/60 px-2.5 py-1.5 text-left text-[10px] font-semibold text-zinc-300 hover:border-[#39FF14]/40 hover:bg-zinc-900/80"
          >
            <span className="text-[#39FF14]">Modo auditoria — gasto médio (28 dias)</span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform', burnAuditOpen && 'rotate-180')}
              aria-hidden
            />
          </button>
          {burnAuditOpen && hints?.dailyBurnAudit ? (
            <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-black/40 px-2 py-2 text-[10px] text-zinc-400">
              <p className="mb-1.5 font-mono text-[#39FF14] leading-snug">
                {hints.dailyBurnAudit.formula}:{' '}
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  hints.dailyBurnAudit.numeratorTotal || 0
                )}{' '}
                ÷ {hints.dailyBurnAudit.divisor} ={' '}
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  hints.dailyBurnReal28d || 0
                )}
                /dia
              </p>
              <p className="mb-1 text-zinc-500">
                Open Finance {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(hints.dailyBurnAudit.openFinanceDebits28d || 0)} + OCR/manual{' '}
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(hints.dailyBurnAudit.ocrManualDebits28d || 0)}
              </p>
              <ul className="space-y-1 border-t border-zinc-800/80 pt-1.5">
                {(hints.dailyBurnAudit.lines || []).slice(0, 40).map((line, idx) => (
                  <li key={`${line.date}-${idx}`} className="flex justify-between gap-2 border-b border-zinc-800/40 pb-1 last:border-0">
                    <span className="min-w-0 flex-1 truncate text-zinc-300" title={line.description}>
                      <span className="text-zinc-600">{line.date}</span> · {line.description}
                    </span>
                    <span className="shrink-0 font-medium text-zinc-200">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(line.amount || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
                <span className="text-[#39FF14] font-semibold">Poder de compra sugerido</span>
                {' '}(Σ contas à vista + Σ crédito disponível; limite do cartão manual alinha por ordem A→Z com
                contas de crédito Open Finance):{' '}
                <strong className="text-zinc-200">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    hints.accountBalanceTotal || 0
                  )}
                </strong>
                {hints?.startingBalanceBreakdown ? (
                  <>
                    {' '}
                    <span className="text-zinc-600">
                      · À vista:{' '}
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        hints.startingBalanceBreakdown.debitAccountsSum || 0
                      )}
                    </span>
                    <span className="text-zinc-600">
                      {' '}
                      · Crédito disponível (estimado):{' '}
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        hints.startingBalanceBreakdown.creditAvailableSum || 0
                      )}
                    </span>
                    {(hints.startingBalanceBreakdown.conservativeNet || 0) !==
                    (hints.startingBalanceBreakdown.purchasingPower || 0) ? (
                      <span className="text-zinc-600">
                        {' '}
                        · Só à vista − dívida no cartão (referência):{' '}
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          hints.startingBalanceBreakdown.conservativeNet || 0
                        )}
                      </span>
                    ) : null}
                    {(hints.startingBalanceBreakdown.naiveSumAllAccounts || 0) !==
                    (hints.accountBalanceTotal || 0) ? (
                      <span className="text-zinc-600">
                        {' '}
                        · Soma bruta Pluggy (referência):{' '}
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          hints.startingBalanceBreakdown.naiveSumAllAccounts || 0
                        )}
                      </span>
                    ) : null}
                  </>
                ) : null}
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
                        <label className={labelClass}>Nível de certeza</label>
                        <select
                          className={fieldClass}
                          value={
                            (c.reliability || 0) >= 0.9
                              ? 'certo'
                              : (c.reliability || 0) >= 0.6
                                ? 'provavel'
                                : 'incerto'
                          }
                          onChange={(e) => setReliabilityByConfidence(c.id, e.target.value)}
                        >
                          <option value="certo">Certo</option>
                          <option value="provavel">Provável</option>
                          <option value="incerto">Incerto</option>
                        </select>
                        <p className="mt-1 text-[10px] text-zinc-500">
                          Usado no gráfico: entradas incertas ficam com maior opacidade (risco).
                        </p>
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
                <div className="space-y-4">
                  {(state.extraRows || []).map((row, idx) => (
                    <div
                      key={row.id}
                      className="rounded-xl border border-zinc-800/90 bg-zinc-950/40 p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-zinc-500">Entrada {idx + 1}</span>
                        {(state.extraRows || []).length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeExtraRow(row.id)}
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-red-400 transition-colors"
                            aria-label="Remover entrada"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <div>
                        <label className={labelClass}>Fonte</label>
                        <input
                          className={fieldClass}
                          placeholder="Ex.: freela designer"
                          value={row.label}
                          onChange={(e) => updateExtraRow(row.id, { label: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelClass}>Valor (R$)</label>
                          <input
                            type="number"
                            min={0}
                            className={fieldClass}
                            value={row.amount}
                            onChange={(e) => updateExtraRow(row.id, { amount: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Dia provável</label>
                        <input
                          type="number"
                          min={1}
                          max={dim}
                          className={fieldClass}
                          value={row.day}
                          onChange={(e) =>
                            updateExtraRow(row.id, {
                              day: clampDayOfMonth(Number(e.target.value), dim),
                              receivedConfirmed: false,
                            })
                          }
                        />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-zinc-500 mb-1">
                          <span>Confiabilidade</span>
                          <span className="text-purple-300">
                            {row.reliabilityPct}% · {reliabilityLabel(row.reliabilityPct)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={row.reliabilityPct}
                          onChange={(e) =>
                            updateExtraRow(row.id, { reliabilityPct: Number(e.target.value) })
                          }
                          className="w-full accent-purple-500"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Nível de necessidade</label>
                        <div className="flex gap-1.5">
                          {(
                            [
                              ['essential', Home, NEED.essential.label],
                              ['leisure', Palmtree, NEED.leisure.label],
                              ['investment', TrendingUp, NEED.investment.label],
                            ]
                          ).map(([key, Icon, lbl]) => (
                            <button
                              type="button"
                              key={key}
                              onClick={() => updateExtraRow(row.id, { necessity: key })}
                              className={cn(
                                'flex flex-1 flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-medium transition-colors',
                                normalizeNecessity(row.necessity) === key
                                  ? 'border-purple-500/70 bg-purple-950/40 text-purple-200'
                                  : 'border-zinc-800 bg-zinc-950/60 text-zinc-500 hover:border-zinc-600'
                              )}
                            >
                              <Icon className="h-4 w-4" aria-hidden />
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="flex items-start gap-2 text-xs text-zinc-400 leading-snug">
                        <input
                          type="checkbox"
                          className="accent-purple-500 mt-0.5"
                          checked={row.committed}
                          onChange={(e) => updateExtraRow(row.id, { committed: e.target.checked })}
                        />
                        Já comprometi esse valor (cartão, parcela, compra) — tratar como se não fosse entrar
                      </label>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addExtraRow}
                    className="w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400 hover:border-purple-500/50 hover:text-purple-200 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar entrada
                  </button>
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
            {pendingExtraRows.length > 0 ? (
              <div className="flex gap-2 rounded-2xl border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-100">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
                <div>
                  <p className="font-medium">Confirme entradas extras atrasadas</p>
                  <p className="mt-1 text-xs leading-snug text-red-200/85">
                    {pendingExtraRows.length === 1
                      ? `O previsto para “${pendingExtraRows[0].label?.trim() || 'Entrada extra'}” já passou — toque no dia no calendário (badge vermelho) e confirme se caiu.`
                      : `${pendingExtraRows.length} entradas com data prevista já passada — use o calendário e o painel do dia para confirmar recebimento (simulação).`}
                  </p>
                </div>
              </div>
            ) : null}

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

            {state.extraEnabled && (necessityBuckets.essential + necessityBuckets.leisure + necessityBuckets.investment) > 0 ? (
              <Card className="border-zinc-800/80">
                <p className="text-sm font-semibold text-zinc-200">Composição das entradas extras (planejado)</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Soma dos valores que você cadastrou, por necessidade — útil para ver se a renda extra vira lazer demais.
                </p>
                <div className="mt-4">
                  <SimuladorNecessityPie buckets={necessityBuckets} />
                </div>
              </Card>
            ) : null}

            <Card className="border-zinc-800/80">
              <SimuladorMonthCalendar
                year={projection.year}
                month={projection.month}
                daysInMonth={projection.daysInMonth}
                points={projection.points}
                uncertaintyBands={uncertaintyBands}
                focusedDay={focusedDay}
                todayDay={todayDay}
                onSelectDay={setFocusedDay}
                pendingConfirmDays={pendingConfirmDays}
              />
            </Card>

            <Card className="border-purple-500/20">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-semibold text-zinc-200">Radar de saldo</span>
                <button
                  type="button"
                  onClick={() => set({ stressMode: !state.stressMode })}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    state.stressMode
                      ? 'border-orange-500/60 bg-orange-500/15 text-orange-200'
                      : 'border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-zinc-500'
                  )}
                >
                  Cenário de Estresse (−30% variáveis)
                </button>
              </div>
              <SimuladorRadarChart
                points={projection.points}
                gaps={projection.gaps}
                stressMode={state.stressMode}
                onDayFocus={setFocusedDay}
                baselineMonthlyExpense={baselineMonthlyExpense}
                uncertaintyBands={uncertaintyBands}
                firstNegativeDay={projection.firstNegativeDay}
              />
            </Card>

            <Drawer.Root
              open={focusedDay != null}
              onOpenChange={(open) => {
                if (!open) setFocusedDay(null);
              }}
            >
              <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px]" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[101] mx-auto flex max-h-[88vh] max-w-md flex-col rounded-t-2xl border border-zinc-800 bg-zinc-950 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 outline-none">
                  <div className="mx-auto mb-3 h-1.5 w-12 shrink-0 rounded-full bg-zinc-600" aria-hidden />
                  <Drawer.Title className="sr-only">
                    Detalhes do dia {focusedDay} no simulador de caixa
                  </Drawer.Title>
                  <Drawer.Description className="sr-only">
                    Saldo projetado e lançamentos simulados para o dia selecionado.
                  </Drawer.Description>
                  {focusedDay != null ? (
                    <>
                      <div className="mb-3 shrink-0 border-b border-zinc-800/80 pb-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Dia {focusedDay}
                          {uncertaintyBands.some((u) => Number(u.day) === focusedDay && Number(u.opacity) >= 0.26) ? (
                            <span className="ml-2 rounded-md border border-dashed border-orange-400/50 px-1.5 py-0.5 text-[10px] font-normal normal-case text-orange-200/90">
                              Entrada incerta
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">Saldo projetado ao fim deste dia</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                            projection.points.find((p) => p.day === focusedDay)?.balance ?? 0
                          )}
                        </p>
                        <p className="mt-2 text-[11px] leading-snug text-zinc-500">
                          Meta diária sugerida (até o salário):{' '}
                          <span className="text-purple-300">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                              metaDiariaSugerida
                            )}
                          </span>
                          /dia
                        </p>
                      </div>

                      {focusedDayPendingExtras.length > 0 ? (
                        <div className="mb-3 shrink-0 rounded-xl border border-red-500/35 bg-red-950/25 px-3 py-2.5">
                          <p className="text-xs font-semibold text-red-200">Confirmar recebimento</p>
                          <p className="mt-1 text-[11px] leading-snug text-red-200/85">
                            A data prevista já passou — confirme se esse valor entrou (alerta neste simulador).
                          </p>
                          <ul className="mt-2 space-y-2">
                            {focusedDayPendingExtras.map((r) => (
                              <li key={r.id} className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate text-sm text-zinc-200">
                                  {r.label?.trim() || 'Entrada extra'}
                                </span>
                                <button
                                  type="button"
                                  className="shrink-0 rounded-lg bg-emerald-600/90 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
                                  onClick={() => updateExtraRow(r.id, { receivedConfirmed: true })}
                                >
                                  Confirmei o recebimento
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                        <p className="mb-2 text-xs font-medium text-zinc-400">Neste dia</p>
                        <ul className="space-y-2 pb-2">
                          {(projection.points.find((p) => p.day === focusedDay)?.events || []).map((ev, i) => {
                            const need = ev.necessity;
                            const NeedIcon =
                              need === 'leisure' ? Palmtree : need === 'investment' ? TrendingUp : need === 'essential' ? Home : null;
                            const showNeedIcon = NeedIcon && Number(ev.value) > 0;
                            return (
                              <li
                                key={i}
                                className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800/90 bg-zinc-900/50 px-3 py-2.5"
                              >
                                <div className="flex min-w-0 flex-1 items-start gap-2">
                                  {showNeedIcon ? (
                                    <NeedIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                                  ) : null}
                                  <div className="min-w-0">
                                    <span className="text-sm text-zinc-300">{ev.label}</span>
                                    {ev.reliabilityPct != null ? (
                                      <p className="mt-0.5 text-[10px] text-zinc-500">
                                        Confiabilidade na simulação: {ev.reliabilityPct}% ·{' '}
                                        {reliabilityLabel(ev.reliabilityPct)}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    'shrink-0 text-sm font-medium tabular-nums',
                                    ev.value < 0 ? 'text-red-400' : 'text-emerald-400'
                                  )}
                                >
                                  {ev.value < 0 ? '−' : '+'}
                                  {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(Math.abs(ev.value))}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </>
                  ) : null}
                </Drawer.Content>
              </Drawer.Portal>
            </Drawer.Root>

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

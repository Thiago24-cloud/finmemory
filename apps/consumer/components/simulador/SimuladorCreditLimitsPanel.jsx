'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  gastoCartaoFromDashboardBalance,
  saldoCartaoComLimiteManual,
} from '../../lib/finance/creditCardGasto';

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

/**
 * Limite manual por cartão (Open Finance): disponível = limite − gasto no dashboard.
 */
export function SimuladorCreditLimitsPanel({
  creditCards = [],
  loading = false,
  fieldClass,
  labelClass,
  onLimitsChange,
  onSaved,
  showFormula = false,
}) {
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const next = {};
    for (const c of creditCards) {
      if (c.bank_account_id) {
        next[c.bank_account_id] =
          c.credit_limit != null && c.credit_limit > 0 ? String(c.credit_limit) : '';
      }
    }
    setDraft(next);
  }, [creditCards]);

  const preview = useMemo(() => {
    return creditCards.map((c) => {
      const limiteRaw = draft[c.bank_account_id];
      const limite = limiteRaw !== '' && limiteRaw != null ? Number(limiteRaw) : null;
      const gasto = c.gasto_dashboard ?? gastoCartaoFromDashboardBalance(c.balance_dashboard);
      const disponivel =
        limite != null && Number.isFinite(limite) && limite > 0
          ? saldoCartaoComLimiteManual(limite, c.balance_dashboard)
          : null;
      return { ...c, limite, gasto, disponivel };
    });
  }, [creditCards, draft]);

  useEffect(() => {
    if (!onLimitsChange) return undefined;
    const t = window.setTimeout(() => onLimitsChange(preview), 280);
    return () => window.clearTimeout(t);
  }, [preview, onLimitsChange]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError('');
    try {
      const limits = creditCards.map((c) => ({
        bank_account_id: c.bank_account_id,
        label: c.name,
        credit_limit:
          draft[c.bank_account_id] !== '' && draft[c.bank_account_id] != null
            ? Number(draft[c.bank_account_id])
            : null,
      }));

      const res = await fetch('/api/simulador/credit-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ limits }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao guardar');
      onSaved?.();
    } catch (e) {
      setSaveError(e?.message || 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }, [creditCards, draft, onSaved]);

  if (!loading && creditCards.length === 0) {
    return (
      <p className="text-[11px] text-zinc-500 leading-snug">
        Conecte um cartão de crédito no Open Finance (dashboard) para informar o limite total aqui.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800/60 p-2.5 space-y-2.5">
      <p className={cn(labelClass, 'mb-0 flex items-center gap-1.5')}>
        <CreditCard className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
        Limites (credito)
      </p>
      {showFormula ? (
        <p className="text-[10px] text-zinc-600">limite − gasto dashboard = disponível</p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando cartões…
        </div>
      ) : (
        <ul className="space-y-2 divide-y divide-zinc-800/50">
          {preview.map((c) => (
            <li key={c.bank_account_id} className="pt-2 first:pt-0 space-y-1.5">
              <div className="flex justify-between gap-2 items-baseline">
                <p className="text-[11px] text-zinc-400 truncate">{c.name}</p>
                <p className="text-[10px] text-zinc-600 shrink-0 tabular-nums">
                  gasto {fmt(c.gasto)}
                  {c.disponivel != null ? (
                    <>
                      {' '}
                      · <span className="text-emerald-400/90">{fmt(c.disponivel)}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div>
                <label className={cn(labelClass, 'text-[10px]')}>Limite (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={fieldClass}
                  placeholder="Ex.: 200"
                  value={draft[c.bank_account_id] ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [c.bank_account_id]: e.target.value }))
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        {saveError ? <p className="text-[10px] text-red-400">{saveError}</p> : <span />}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading || creditCards.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600/90 hover:bg-purple-600 disabled:opacity-50 text-white text-[11px] font-medium px-3 py-1.5"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar limites
        </button>
      </div>
    </div>
  );
}

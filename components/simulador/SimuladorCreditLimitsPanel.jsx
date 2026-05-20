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
    <div className="rounded-xl border border-purple-500/25 bg-purple-950/20 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <CreditCard className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={cn(labelClass, 'text-purple-200/90 mb-0')}>Limites dos cartões de crédito</p>
          <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
            Digite o <strong className="text-zinc-400">limite total</strong> de cada cartão. O app usa o
            valor do <strong className="text-zinc-400">dashboard</strong> como gasto e calcula: limite −
            gasto = disponível no simulador.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando cartões…
        </div>
      ) : (
        <ul className="space-y-3">
          {preview.map((c) => (
            <li
              key={c.bank_account_id}
              className="rounded-lg border border-zinc-700/80 bg-zinc-950/60 p-2.5 space-y-2"
            >
              <p className="text-xs font-semibold text-zinc-200 truncate">{c.name}</p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <span className="text-zinc-500">
                  Gasto (dashboard):{' '}
                  <strong className="text-zinc-300">{fmt(c.gasto)}</strong>
                </span>
                <span className="text-zinc-500 text-right">
                  Disponível:{' '}
                  <strong className="text-[#39FF14]">
                    {c.disponivel != null ? fmt(c.disponivel) : '—'}
                  </strong>
                </span>
              </div>
              <div>
                <label className={cn(labelClass, 'text-[10px]')}>Limite total do cartão (R$)</label>
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar limites
        </button>
      </div>
    </div>
  );
}

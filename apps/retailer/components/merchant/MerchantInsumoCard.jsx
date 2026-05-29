'use client';

import { useState } from 'react';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';

const UNIDADE_LABEL = {
  un: 'un',
  kg: 'kg',
  g: 'g',
  L: 'L',
  ml: 'ml',
  cx: 'cx',
  pct: 'pct',
  dz: 'dz',
};

function formatBrl(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function formatQty(value, unidade) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const label = UNIDADE_LABEL[unidade] || unidade || 'un';
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${label}`;
}

export function MerchantInsumoCard({ insumo, onUpdated, onRemoved }) {
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!confirm(`Remover "${insumo.nome}" da lista de insumos?`)) return;
    setBusy(true);
    try {
      const res = await fetch(painelApi.insumo(insumo.id), { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Não foi possível remover.');
        return;
      }
      onRemoved?.(insumo.id);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const toggleRecorrente = async () => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.insumo(insumo.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recorrente: !insumo.recorrente }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Erro ao atualizar.');
        return;
      }
      onUpdated?.(data.insumo);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={`rounded-xl border p-3 sm:p-4 ${
        insumo.abaixo_minimo
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold m-0 truncate">{insumo.nome}</h3>
            {insumo.recorrente ? (
              <span className="text-[10px] uppercase tracking-wide text-[#39FF14]/80 bg-[#39FF14]/10 border border-[#39FF14]/25 px-2 py-0.5 rounded-full">
                Recorrente
              </span>
            ) : null}
            {insumo.abaixo_minimo ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-200 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Abaixo do mínimo
              </span>
            ) : null}
          </div>
          <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs m-0">
            <div>
              <dt className="text-white/45 m-0">Em estoque</dt>
              <dd className="text-white/90 font-medium m-0 mt-0.5">
                {formatQty(insumo.quantidade_atual, insumo.unidade)}
              </dd>
            </div>
            <div>
              <dt className="text-white/45 m-0">Mínimo</dt>
              <dd className="text-white/90 font-medium m-0 mt-0.5">
                {formatQty(insumo.estoque_minimo, insumo.unidade)}
              </dd>
            </div>
            <div>
              <dt className="text-white/45 m-0">Custo médio</dt>
              <dd className="text-white/90 font-medium m-0 mt-0.5">{formatBrl(insumo.custo_medio)}</dd>
            </div>
            <div>
              <dt className="text-white/45 m-0">Código</dt>
              <dd className="text-white/70 font-mono text-[11px] m-0 mt-0.5 truncate">
                {insumo.ean || '—'}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleRecorrente()}
            className="text-[10px] text-white/50 hover:text-white/80 px-2 py-1 rounded border border-white/10"
          >
            {insumo.recorrente ? 'Não recorrente' : 'Marcar recorrente'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="inline-flex items-center justify-center gap-1 text-[10px] text-red-300 hover:bg-red-500/10 px-2 py-1 rounded border border-red-500/20"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Trash2 className="h-3 w-3" aria-hidden />}
            Remover
          </button>
        </div>
      </div>
    </li>
  );
}

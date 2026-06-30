'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Boxes, AlertTriangle, FileText, Upload, ScanBarcode } from 'lucide-react';
import Link from 'next/link';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { formatMerchantApiError, logMerchantApiFailure } from '../../lib/merchant/merchantApiErrorMessage';
import { MerchantInsumoForm } from './MerchantInsumoForm';
import { MerchantInsumoCard } from './MerchantInsumoCard';
import { MerchantNotaEntradaFlow } from './MerchantNotaEntradaFlow';
import { MerchantInsumoImportFlow } from './MerchantInsumoImportFlow';
import { useInsumosLojaRealtime } from '../../hooks/useInsumosLojaRealtime';

function formatBrl(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function formatNotaDate(iso) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function MerchantInsumosSection({ lojaId, onCountChange }) {
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [notaFlowOpen, setNotaFlowOpen] = useState(false);
  const [importFlowOpen, setImportFlowOpen] = useState(false);
  const [notas, setNotas] = useState([]);
  const [stats, setStats] = useState({ total: 0, abaixo_minimo: 0, pendente_revisao: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [insRes, notasRes] = await Promise.all([
        fetch(`${painelApi.insumos}?include_pending=1`),
        fetch(painelApi.notasEntrada),
      ]);
      const data = await insRes.json().catch(() => ({}));
      const notasData = await notasRes.json().catch(() => ({}));
      if (!insRes.ok) {
        logMerchantApiFailure('insumos', insRes, data);
        setInsumos([]);
        setError(
          formatMerchantApiError(
            insRes,
            data,
            'Erro ao carregar insumos. Se for a primeira vez, execute a migração SQL no Supabase (run-insumos-loja-migration.sql).'
          )
        );
        return;
      }
      const list = data.insumos || [];
      const ativos = list.filter((i) => i.ativo && i.status_revisao !== 'pendente');
      setInsumos(ativos);
      setStats({
        total: data.total ?? ativos.length,
        abaixo_minimo: data.abaixo_minimo ?? ativos.filter((i) => i.abaixo_minimo).length,
        pendente_revisao: data.pendente_revisao ?? list.filter((i) => i.status_revisao === 'pendente').length,
      });
      onCountChange?.(ativos.length);
      if (notasRes.ok) setNotas(notasData.notas || []);
    } catch {
      setError('Erro de rede ao carregar insumos.');
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useInsumosLojaRealtime(lojaId, load);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const onSaved = (insumo) => {
    setFormOpen(false);
    setInsumos((prev) => {
      const next = [...prev, insumo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      onCountChange?.(next.length);
      return next;
    });
    setStats((s) => ({
      total: s.total + 1,
      abaixo_minimo: s.abaixo_minimo + (insumo.abaixo_minimo ? 1 : 0),
    }));
  };

  const onUpdated = (updated) => {
    setInsumos((prev) =>
      prev
        .map((i) => (i.id === updated.id ? updated : i))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    );
    void load();
  };

  const onRemoved = (id) => {
    setInsumos((prev) => {
      const next = prev.filter((i) => i.id !== id);
      onCountChange?.(next.length);
      return next;
    });
    void load();
  };

  const approveAllPending = async () => {
    try {
      const res = await fetch(painelApi.insumosImportApprove, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) void load();
      else setError(data.error || 'Erro ao aprovar pendentes.');
    } catch {
      setError('Erro de rede ao aprovar pendentes.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-7 w-7 animate-spin text-[#39FF14]" aria-label="Carregando insumos" />
      </div>
    );
  }

  return (
    <section>
      {error ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 m-0" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs">
            <Boxes className="h-3.5 w-3.5 text-white/50" aria-hidden />
            {stats.total} insumo{stats.total === 1 ? '' : 's'}
          </span>
          {stats.abaixo_minimo > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 px-3 py-1.5 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {stats.abaixo_minimo} abaixo do mínimo
            </span>
          ) : null}
        </div>
        <p className="text-[11px] text-white/45 mt-3 m-0 leading-relaxed">
          Importe seu estoque do ERP ou cadastre manualmente. Para manter atualizado sem planilha, use entrada por NF (foto/QR).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setImportFlowOpen(true);
              setNotaFlowOpen(false);
              setFormOpen(false);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/[0.08]"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Importar estoque (CSV)
          </button>
          <button
            type="button"
            onClick={() => {
              setNotaFlowOpen(true);
              setImportFlowOpen(false);
              setFormOpen(false);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#39FF14]/45 bg-[#39FF14]/10 px-4 py-2.5 text-sm font-semibold text-[#39FF14] hover:bg-[#39FF14]/15"
          >
            <FileText className="h-4 w-4" aria-hidden />
            Entrada por nota fiscal
          </button>
          <Link
            href="/parceiros/painel/estoque/camera"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/[0.08]"
          >
            <ScanBarcode className="h-4 w-4 text-[#39FF14]" aria-hidden />
            Câmera (entrada/saída)
          </Link>
        </div>
        {stats.pendente_revisao > 0 ? (
          <p className="text-xs text-amber-200/90 mt-3 m-0 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {stats.pendente_revisao} item(ns) pendente(s) de revisão —{' '}
            <button type="button" onClick={() => void approveAllPending()} className="underline hover:no-underline">
              aprovar todos
            </button>
          </p>
        ) : null}
      </div>

      {importFlowOpen ? (
        <div className="mb-4">
          <MerchantInsumoImportFlow
            pendingCount={stats.pendente_revisao}
            onApprovePending={() => void approveAllPending()}
            onConfirmed={() => void load()}
            onClose={() => setImportFlowOpen(false)}
          />
        </div>
      ) : null}

      {notaFlowOpen ? (
        <div className="mb-4">
          <MerchantNotaEntradaFlow
            insumos={insumos}
            onConfirmed={() => {
              setNotaFlowOpen(false);
              void load();
            }}
            onClose={() => setNotaFlowOpen(false)}
          />
        </div>
      ) : null}

      {notas.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 mb-4">
          <h3 className="text-xs font-bold text-white/60 uppercase tracking-wide m-0 mb-2">Últimas entradas (NF)</h3>
          <ul className="space-y-2 list-none p-0 m-0">
            {notas.slice(0, 5).map((nota) => (
              <li key={nota.id} className="text-xs text-white/70 flex justify-between gap-2">
                <span className="truncate">{nota.fornecedor || 'Fornecedor'}</span>
                <span className="shrink-0 text-white/45">{formatNotaDate(nota.created_at)}</span>
                <span className="shrink-0 font-medium text-white/90">{formatBrl(nota.valor_total)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold m-0">Insumos e estoque</h2>
        {!formOpen && !notaFlowOpen && !importFlowOpen ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-bold text-[#050508] hover:brightness-110"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Novo insumo
          </button>
        ) : null}
      </div>

      {formOpen ? (
        <MerchantInsumoForm onSaved={onSaved} onCancel={() => setFormOpen(false)} />
      ) : null}

      {insumos.length === 0 && !formOpen && !notaFlowOpen && !importFlowOpen ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <Boxes className="h-10 w-10 text-white/20 mx-auto mb-3" aria-hidden />
          <p className="text-sm text-white/50 m-0">
            Nenhum insumo cadastrado. Comece listando farinha, óleo, embalagens e outros itens que você compra todo mês.
          </p>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#39FF14]/40 text-[#39FF14] px-4 py-2 text-sm font-semibold hover:bg-[#39FF14]/10"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Cadastrar primeiro insumo
          </button>
        </div>
      ) : (
        <ul className="mt-4 space-y-3 list-none p-0 m-0">
          {insumos.map((insumo) => (
            <MerchantInsumoCard
              key={insumo.id}
              insumo={insumo}
              onUpdated={onUpdated}
              onRemoved={onRemoved}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

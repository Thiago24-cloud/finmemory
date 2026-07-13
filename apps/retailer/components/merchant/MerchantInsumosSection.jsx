'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ScanBarcode,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { formatMerchantApiError, logMerchantApiFailure } from '../../lib/merchant/merchantApiErrorMessage';
import { MerchantInsumoForm } from './MerchantInsumoForm';
import { MerchantInsumoCard } from './MerchantInsumoCard';
import { MerchantNotaEntradaFlow } from './MerchantNotaEntradaFlow';
import { MerchantInsumoImportFlow } from './MerchantInsumoImportFlow';
import { useInsumosLojaRealtime } from '../../hooks/useInsumosLojaRealtime';
import { SkipPageHeader } from './skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from './skip/SkipCard';
import { SkipButton } from './skip/SkipButton';
import { SkipBadge } from './skip/SkipBadge';

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
  const [stats, setStats] = useState({
    total: 0,
    abaixo_minimo: 0,
    pendente_revisao: 0,
    imageStats: null,
    totalUnits: 0,
  });
  const [syncingCatalog, setSyncingCatalog] = useState(false);

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
        imageStats: data.summary?.imageStats ?? null,
        totalUnits: data.summary?.totalUnits ?? 0,
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
      ...s,
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

  const syncCatalog = async () => {
    setSyncingCatalog(true);
    setError('');
    try {
      const res = await fetch(painelApi.catalogSync, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro ao publicar catálogo.');
        return;
      }
      alert(
        `Catálogo sincronizado: ${data.synced ?? 0} produto(s) atualizado(s), ${data.skipped ?? 0} ignorado(s) (sem custo médio).`
      );
    } catch {
      setError('Erro de rede ao sincronizar catálogo.');
    } finally {
      setSyncingCatalog(false);
    }
  };

  const imageStats = stats.imageStats;

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
      <div className="flex justify-center py-12 animate-fade-in-up">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Carregando insumos" />
      </div>
    );
  }

  return (
    <section className="animate-fade-in-up">
      <SkipPageHeader
        icon={Boxes}
        title="Estoque"
        description="Gerencie seus produtos e ingredientes"
      />

      {error ? (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-4 m-0" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link
          href="/parceiros/painel/estoque/camera"
          className="inline-flex items-center justify-center gap-2 h-14 rounded-xl border border-input bg-background hover:bg-muted transition-colors text-sm font-medium shadow-subtle"
        >
          <ScanBarcode className="w-5 h-5 text-primary" />
          Escanear código
        </Link>
        <SkipButton
          variant="outline"
          className="h-14 rounded-xl"
          onClick={() => {
            setNotaFlowOpen(true);
            setImportFlowOpen(false);
            setFormOpen(false);
          }}
        >
          <FileText className="w-5 h-5" />
          Importar NF-e
        </SkipButton>
      </div>

      <SkipCard className="shadow-subtle mb-4">
        <SkipCardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <SkipBadge className="bg-muted text-foreground border-border">
              <Boxes className="h-3 w-3 mr-1 inline" />
              {stats.total} insumo{stats.total === 1 ? '' : 's'}
            </SkipBadge>
            {stats.abaixo_minimo > 0 ? (
              <SkipBadge className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                <AlertTriangle className="h-3 w-3 mr-1 inline" />
                {stats.abaixo_minimo} abaixo do mínimo
              </SkipBadge>
            ) : null}
            {imageStats ? (
              <>
                {imageStats.openfoodfacts > 0 ? (
                  <SkipBadge className="bg-muted text-muted-foreground border-border text-[11px]">
                    {imageStats.openfoodfacts} OFF
                  </SkipBadge>
                ) : null}
                {imageStats.cosmos > 0 ? (
                  <SkipBadge className="bg-muted text-muted-foreground border-border text-[11px]">
                    {imageStats.cosmos} Cosmos
                  </SkipBadge>
                ) : null}
              </>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground m-0 leading-relaxed">
            Importe seu estoque do ERP ou cadastre manualmente. Para manter atualizado, use entrada por NF (foto/QR).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <SkipButton
              variant="outline"
              size="sm"
              onClick={() => {
                setImportFlowOpen(true);
                setNotaFlowOpen(false);
                setFormOpen(false);
              }}
            >
              <Upload className="h-4 w-4" />
              Importar CSV
            </SkipButton>
            <SkipButton
              variant="outline"
              size="sm"
              disabled={syncingCatalog}
              onClick={() => void syncCatalog()}
            >
              {syncingCatalog ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Publicar catálogo
            </SkipButton>
          </div>
          {stats.pendente_revisao > 0 ? (
            <p className="text-xs text-amber-700 mt-3 m-0 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {stats.pendente_revisao} item(ns) pendente(s) —{' '}
              <button type="button" onClick={() => void approveAllPending()} className="underline hover:no-underline bg-transparent border-0 cursor-pointer p-0 text-inherit">
                aprovar todos
              </button>
            </p>
          ) : null}
        </SkipCardContent>
      </SkipCard>

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
        <SkipCard className="shadow-subtle mb-4">
          <SkipCardContent className="p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide m-0 mb-2">Últimas entradas (NF)</h3>
            <ul className="space-y-2 list-none p-0 m-0">
              {notas.slice(0, 5).map((nota) => (
                <li key={nota.id} className="text-xs flex justify-between gap-2">
                  <span className="truncate">{nota.fornecedor || 'Fornecedor'}</span>
                  <span className="shrink-0 text-muted-foreground">{formatNotaDate(nota.created_at)}</span>
                  <span className="shrink-0 font-medium">{formatBrl(nota.valor_total)}</span>
                </li>
              ))}
            </ul>
          </SkipCardContent>
        </SkipCard>
      ) : null}

      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide m-0">Insumos</h2>
        {!formOpen && !notaFlowOpen && !importFlowOpen ? (
          <SkipButton size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo insumo
          </SkipButton>
        ) : null}
      </div>

      {formOpen ? (
        <MerchantInsumoForm onSaved={onSaved} onCancel={() => setFormOpen(false)} />
      ) : null}

      {insumos.length === 0 && !formOpen && !notaFlowOpen && !importFlowOpen ? (
        <SkipCard className="border-dashed shadow-subtle">
          <SkipCardContent className="p-8 text-center">
            <Boxes className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden />
            <p className="text-sm text-muted-foreground m-0">
              Nenhum insumo cadastrado. Comece listando farinha, óleo, embalagens e outros itens que você compra todo mês.
            </p>
            <SkipButton variant="outline" className="mt-4" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Cadastrar primeiro insumo
            </SkipButton>
          </SkipCardContent>
        </SkipCard>
      ) : (
        <ul className="space-y-3 list-none p-0 m-0">
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

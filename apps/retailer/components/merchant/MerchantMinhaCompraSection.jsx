'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { SkipPageHeader } from './skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from './skip/SkipCard';
import { SkipButton } from './skip/SkipButton';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { buildCestaConsumerMapUrl } from '../../lib/merchant/compras/cestaMapUrl';
import { offerKey } from '../../lib/merchant/compras/cestaCompare';
import { InsumoProductImage } from './InsumoProductImage';

const LEGACY_STORAGE_KEY = 'finmemory_parceiros_lista_compras_v1';

function formatBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function CestaItemImage({ insumo }) {
  return (
    <InsumoProductImage
      insumo={insumo}
      className="h-14 w-14 shrink-0 border border-border"
      iconClassName="h-6 w-6"
      roundedClassName="rounded-xl"
    />
  );
}

function matchSourceLabel(source, method) {
  if (method === 'gtin') return 'GTIN';
  if (source === 'cosmos_gtin') return 'Cosmos GTIN';
  if (source === 'cosmos_query') return 'Cosmos';
  if (source === 'heuristic') return 'Texto';
  if (source === 'manual') return 'Manual';
  return null;
}

export function MerchantMinhaCompraSection({ storeLat, storeLng, onOpenMap }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [data, setData] = useState(null);
  const [expandedStore, setExpandedStore] = useState(null);
  const [swapItem, setSwapItem] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allInsumos, setAllInsumos] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const simulateTimer = useRef(null);
  const pendingSelections = useRef([]);

  const loadCesta = useCallback(async () => {
    setLoading(true);
    setError('');
    setMigrationRequired(false);
    try {
      const res = await fetch(painelApi.comprasCesta);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.code === 'CESTA_MIGRATION_REQUIRED') {
          setMigrationRequired(true);
        }
        setError(json.error || 'Não foi possível carregar a cesta.');
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError('Erro de rede ao carregar a cesta.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCesta();
  }, [loadCesta]);

  const runSimulate = useCallback((selections) => {
    if (simulateTimer.current) window.clearTimeout(simulateTimer.current);
    simulateTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(painelApi.comprasSimulate, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selections }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setData((prev) => (prev ? { ...prev, ...json } : json));
        }
      } catch {
        /* preview only */
      }
    }, 400);
  }, []);

  const persistOffer = async (insumoId, offer) => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.comprasCesta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', insumoId, cesta_oferta: offer }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Não foi possível salvar a escolha.');
        return;
      }
      setData(json);
      setSwapItem(null);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const previewOffer = (insumoId, offer) => {
    const selections = [{ insumoId, offer }];
    pendingSelections.current = selections;
    runSimulate(selections);
  };

  const updateQuantity = async (insumoId, quantidade) => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.comprasCesta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', insumoId, cesta_quantidade: quantidade }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Erro ao atualizar quantidade.');
        return;
      }
      setData(json);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (insumoId) => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.comprasCesta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', insumoId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Erro ao remover.');
        return;
      }
      setData(json);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const syncLowStock = async () => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.comprasCesta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_low_stock' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Erro ao sincronizar estoque baixo.');
        return;
      }
      setData(json);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setPickerLoading(true);
    try {
      const res = await fetch(painelApi.insumos);
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json.insumos)) {
        setAllInsumos(json.insumos.filter((i) => i.ativo !== false));
      }
    } catch {
      /* ignore */
    } finally {
      setPickerLoading(false);
    }
  };

  const enrichMatch = async (insumoId, { force = false } = {}) => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.comprasMatch, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insumoId, force }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Não foi possível melhorar o match.');
        return;
      }
      setData(json);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const enrichAllMatch = async () => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.comprasMatch, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrichAll: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Não foi possível atualizar o catálogo.');
        return;
      }
      setData(json);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const addInsumoToCesta = async (insumoId) => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.comprasCesta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', insumoId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Erro ao adicionar.');
        return;
      }
      setData(json);
      setPickerOpen(false);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const items = data?.items || [];
  const stores = data?.stores || [];
  const summary = data?.summary;
  const cestaIds = useMemo(() => new Set(items.map((i) => i.insumoId)), [items]);

  const mapUrl = useMemo(() => {
    if (!items.length) return null;
    return buildCestaConsumerMapUrl({
      items,
      stores,
      summary,
      storeLat,
      storeLng,
      minCoverage: 1,
    });
  }, [items, stores, summary, storeLat, storeLng]);

  const routeTotal = summary?.estimatedBestTotal ?? stores[0]?.total ?? 0;

  return (
    <div className="space-y-5 animate-fade-in-up">
      <SkipPageHeader
        icon={ShoppingBag}
        title="Rota de Compras"
        description="Organizamos seus itens pelos melhores locais."
      />

      <div className="flex flex-wrap gap-2">
        <SkipButton onClick={() => void openPicker()} disabled={busy || migrationRequired}>
          <Plus className="h-4 w-4" aria-hidden />
          Do estoque
        </SkipButton>
        <SkipButton variant="outline" onClick={() => void syncLowStock()} disabled={busy || migrationRequired}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Abaixo do mínimo
        </SkipButton>
        <SkipButton variant="outline" onClick={() => void enrichAllMatch()} disabled={busy || migrationRequired}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Catálogo Cosmos
        </SkipButton>
      </div>

      {migrationRequired ? (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 m-0" role="alert">
          Execute as migrations{' '}
          <code className="text-amber-800">20260706120000_insumos_loja_cesta_compras.sql</code> e{' '}
          <code className="text-amber-800">20260706140000_insumos_loja_match_catalog.sql</code> no Supabase.
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          Carregando cesta…
        </div>
      ) : null}

      {error && !loading ? (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 m-0" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && items.length === 0 && !error && !migrationRequired ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground text-center px-4">
          <ShoppingBag className="w-24 h-24 mb-6 opacity-20" />
          <h2 className="text-xl font-semibold text-foreground mb-2 m-0">Sua lista está vazia</h2>
          <p className="max-w-[250px] m-0 text-sm">
            Busque produtos na aba de Preços e adicione-os à sua lista, ou use &quot;Do estoque&quot; / &quot;Abaixo do mínimo&quot;.
          </p>
        </div>
      ) : null}

      {!loading && items.length > 0 && routeTotal > 0 ? (
        <SkipCard className="bg-primary text-primary-foreground border-none shadow-subtle relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Store className="w-24 h-24" />
          </div>
          <SkipCardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-semibold opacity-80 uppercase tracking-widest mb-1 m-0">Total da rota</p>
              <div className="text-3xl font-bold">{formatBrl(routeTotal)}</div>
              {summary ? (
                <p className="text-xs opacity-80 mt-1 m-0">
                  {summary.matched}/{summary.total} itens com oferta
                  {summary.storesCount > 0 ? ` · ${summary.storesCount} mercado(s)` : ''}
                </p>
              ) : null}
            </div>
          </SkipCardContent>
        </SkipCard>
      ) : null}

      {!loading && summary && items.length > 0 && routeTotal <= 0 ? (
        <p className="text-xs font-semibold text-primary m-0">
          {summary.matched}/{summary.total} itens com oferta
          {summary.storesCount > 0 ? ` · ${summary.storesCount} mercado(s)` : ''}
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="space-y-3 list-none p-0 m-0">
          {items.map((item) => (
            <li
              key={item.insumoId}
              className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-subtle"
            >
              <div className="flex gap-3">
                <CestaItemImage insumo={item} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground m-0 truncate">{item.nome}</p>
                      {item.canonical_name &&
                      item.canonical_name.toLowerCase() !== item.nome.toLowerCase() ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5 m-0 truncate">{item.canonical_name}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {matchSourceLabel(item.match_source, item.matchMethod) ? (
                          <span className="text-[9px] uppercase tracking-wide text-primary/80 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                            {matchSourceLabel(item.match_source, item.matchMethod)}
                          </span>
                        ) : null}
                        {item.abaixo_minimo ? (
                          <span className="text-[10px] text-amber-600">Abaixo do mínimo</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeItem(item.insumoId)}
                      disabled={busy}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                      aria-label={`Remover ${item.nome}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      Qtd
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        defaultValue={item.quantidade}
                        key={`${item.insumoId}-${item.quantidade}`}
                        disabled={busy}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v > 0 && v !== item.quantidade) {
                            void updateQuantity(item.insumoId, v);
                          }
                        }}
                        className="w-16 rounded-lg border border-border bg-muted/30 px-2 py-1 text-xs text-foreground"
                      />
                      <span className="text-muted-foreground">{item.unidade || 'un'}</span>
                    </label>
                  </div>

                  {item.matched ? (
                    <div className="mt-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-primary m-0">
                          {formatBrl(item.lineTotal)}
                          <span className="text-[10px] font-normal text-muted-foreground ml-1">
                            ({formatBrl(item.selectedOffer?.preco)}/un)
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 m-0 truncate">
                          {item.selectedOffer?.produto_nome || item.nome}
                          {item.selectedOffer?.nome_loja ? ` · ${item.selectedOffer.nome_loja}` : ''}
                        </p>
                      </div>
                      {item.offersCount > 1 ? (
                        <button
                          type="button"
                          onClick={() => setSwapItem(item)}
                          disabled={busy}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/15 disabled:opacity-50"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                          Trocar
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="text-[11px] text-muted-foreground m-0">Sem oferta no mapa para este insumo.</p>
                      <button
                        type="button"
                        onClick={() => void enrichMatch(item.insumoId, { force: true })}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-foreground/70 hover:bg-muted disabled:opacity-50"
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden />
                        Melhorar match
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && stores.length > 0 ? (
        <section>
          <h3 className="text-sm font-bold text-foreground m-0 mb-3 flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" aria-hidden />
            Total por supermercado
          </h3>
          <ul className="space-y-3 list-none p-0 m-0">
            {stores.map((store) => {
              const isOpen = expandedStore === store.storeName;
              return (
                <li
                  key={store.storeId || store.storeName}
                  className="rounded-2xl border border-border bg-card overflow-hidden shadow-subtle"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedStore(isOpen ? null : store.storeName)}
                    className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground m-0 truncate">{store.storeName}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 m-0">
                        {store.coveredItems}/{store.totalItems} itens · {store.coveragePct}% cobertura
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-black text-primary">{formatBrl(store.total)}</span>
                  </button>
                  {isOpen ? (
                    <ul className="border-t border-border px-4 py-2 space-y-1.5 list-none m-0">
                      {store.lines.map((line) => (
                        <li
                          key={`${store.storeName}-${line.insumoId}`}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-foreground truncate">
                            {line.listName}
                            {line.productName &&
                            line.productName.toLowerCase() !== line.listName.toLowerCase() ? (
                              <span className="text-muted-foreground"> · {line.productName}</span>
                            ) : null}
                            {line.quantidade > 1 ? (
                              <span className="text-muted-foreground"> ×{line.quantidade}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 font-semibold text-foreground">{formatBrl(line.lineTotal)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="text-[10px] text-muted-foreground mt-2 m-0">
            Totais recalculam ao trocar produto. Usa a oferta escolhida quando disponível naquele mercado.
          </p>
        </section>
      ) : null}

      {mapUrl ? (
        <div className="space-y-2">
          {stores.length > 0 ? (
            <p className="text-[10px] text-muted-foreground m-0">
              Mapa filtrado: {stores.length} mercado(s) com itens da sua cesta.
            </p>
          ) : null}
          <button
          type="button"
          onClick={() => {
            if (typeof onOpenMap === 'function') onOpenMap(mapUrl);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-3 text-sm font-bold text-primary hover:bg-primary/15"
        >
          <MapPin className="h-4 w-4" aria-hidden />
          Ver cesta no mapa
        </button>
        </div>
      ) : null}

      {swapItem ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="swap-title"
        >
          <div className="w-full max-w-md max-h-[80vh] overflow-hidden rounded-2xl border border-border bg-card flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
              <h3 id="swap-title" className="text-sm font-bold text-foreground m-0 truncate">
                Trocar · {swapItem.nome}
              </h3>
              <button
                type="button"
                onClick={() => setSwapItem(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <ul className="overflow-y-auto p-2 space-y-1 list-none m-0 flex-1">
              {(swapItem.offers || []).map((offer) => {
                const selected = offerKey(offer) === swapItem.selectedOfferKey;
                return (
                  <li key={offerKey(offer)}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        previewOffer(swapItem.insumoId, offer);
                        void persistOffer(swapItem.insumoId, offer);
                      }}
                      className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${
                        selected
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border bg-card hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground m-0 line-clamp-2">{offer.produto_nome}</p>
                        <span className="shrink-0 text-sm font-black text-primary">{formatBrl(offer.preco)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 m-0">{offer.nome_loja}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}

      {pickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="picker-title"
        >
          <div className="w-full max-w-md max-h-[80vh] overflow-hidden rounded-2xl border border-border bg-card flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
              <h3 id="picker-title" className="text-sm font-bold text-foreground m-0">
                Adicionar do estoque
              </h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {pickerLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Carregando insumos…
              </div>
            ) : (
              <ul className="overflow-y-auto p-2 space-y-1 list-none m-0 flex-1">
                {allInsumos
                  .filter((i) => !cestaIds.has(i.id))
                  .map((insumo) => (
                    <li key={insumo.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void addInsumoToCesta(insumo.id)}
                        className="w-full text-left rounded-xl px-3 py-2.5 border border-border bg-card hover:bg-muted/50 flex items-center gap-3"
                      >
                        <CestaItemImage insumo={insumo} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground m-0 truncate">{insumo.nome}</p>
                          {insumo.abaixo_minimo ? (
                            <p className="text-[10px] text-amber-400 mt-0.5 m-0">Abaixo do mínimo</p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  ))}
                {allInsumos.filter((i) => !cestaIds.has(i.id)).length === 0 ? (
                  <li className="text-center text-xs text-muted-foreground py-8">Todos os insumos já estão na cesta.</li>
                ) : null}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { LEGACY_STORAGE_KEY };

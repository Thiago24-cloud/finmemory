'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, Plus, Scale, Store, Tag, Trash2, X } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { buildConsumerMapUrl } from '../../lib/consumerAppUrl';
import {
  loadShoppingListDraft,
  parseDraftInput,
  saveShoppingListDraft,
} from '../../lib/merchant/compras/shoppingListDraft';

function formatBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Fase 1: montar a lista completa.
 * Fase 2: um toque em “Comparar preços” (não busca a cada item).
 */
export function MerchantListaComprasSection({ storeLat, storeLng, onOpenMap, onOpenRota }) {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [compared, setCompared] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expandedStore, setExpandedStore] = useState(null);

  useEffect(() => {
    setItems(loadShoppingListDraft());
  }, []);

  useEffect(() => {
    saveShoppingListDraft(items);
  }, [items]);

  const fetchCompare = useCallback(async () => {
    if (!items.length) {
      setData(null);
      setError('');
      setCompared(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const q = items.join(',');
      const res = await fetch(`${painelApi.listaComprasCompare}?names=${encodeURIComponent(q)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Não foi possível comparar preços.');
        setData(null);
        setCompared(false);
        return;
      }
      setData(json);
      setCompared(true);
    } catch {
      setError('Erro de rede ao buscar preços.');
      setData(null);
      setCompared(false);
    } finally {
      setLoading(false);
    }
  }, [items]);

  const mapUrl = useMemo(() => {
    const lista = items.join(',');
    const opts = { from: 'parceiros', embed: true, lista };
    if (storeLat != null && storeLng != null) {
      opts.lat = storeLat;
      opts.lng = storeLng;
      opts.zoom = 14;
    }
    return buildConsumerMapUrl(opts);
  }, [items, storeLat, storeLng]);

  const addItemsFromDraft = () => {
    if (!draft.trim()) return;
    setItems((prev) => parseDraftInput(draft, prev));
    setDraft('');
    setCompared(false);
    setData(null);
    setError('');
  };

  const removeItem = (name) => {
    setItems((prev) => prev.filter((n) => n !== name));
    setCompared(false);
    setData(null);
  };

  const clearList = () => {
    setItems([]);
    setData(null);
    setCompared(false);
    setError('');
  };

  const stores = data?.stores || [];
  const matchedItems = (data?.items || []).filter((i) => i.matched);
  const summary = data?.summary;

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div>
        <h2 className="text-lg font-bold m-0 text-foreground">Lista de compras</h2>
        <p className="text-xs text-muted-foreground mt-2 m-0 leading-relaxed">
          Monte a lista completa primeiro (arroz, feijão, óleo…). Depois compare os preços de uma vez —
          total por mercado e melhor preço por item.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary m-0">
          1 · Montar lista
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addItemsFromDraft();
              }
            }}
            placeholder="Ex.: arroz, feijão, óleo de soja"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={addItemsFromDraft}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-95"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </button>
        </div>

        {items.length > 0 ? (
          <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
            {items.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 pl-3 pr-1.5 py-1 text-xs font-semibold text-foreground"
              >
                {name}
                <button
                  type="button"
                  onClick={() => removeItem(name)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remover ${name}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground m-0">
            Digite vários produtos separados por vírgula e toque em Add.
          </p>
        )}

        {items.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void fetchCompare()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Scale className="h-4 w-4" aria-hidden />
              )}
              Comparar preços ({items.length})
            </button>
            <button
              type="button"
              onClick={clearList}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Limpar
            </button>
          </div>
        ) : null}
      </div>

      {items.length > 0 && !compared && !loading && !error ? (
        <p className="text-xs text-muted-foreground m-0 rounded-xl border border-dashed border-border px-3 py-2">
          2 · Quando a lista estiver pronta, toque em <strong>Comparar preços</strong>.
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          Comparando preços no mapa…
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 m-0" role="alert">
          {error}
        </p>
      ) : null}

      {compared && !loading && summary ? (
        <p className="text-xs font-semibold text-primary m-0">
          {summary.matched}/{summary.total} itens com oferta
          {summary.storesCount > 0 ? ` · ${summary.storesCount} mercado(s)` : ''}
        </p>
      ) : null}

      {compared && !loading && stores.length > 0 ? (
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
                          key={`${store.storeName}-${line.listName}`}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-foreground truncate">
                            {line.listName}
                            {line.productName &&
                            line.productName.toLowerCase() !== line.listName.toLowerCase() ? (
                              <span className="text-muted-foreground"> · {line.productName}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 font-semibold text-foreground">{formatBrl(line.price)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="text-[10px] text-muted-foreground mt-2 m-0">
            Total = soma do melhor preço de cada item naquele mercado. Itens sem oferta não entram no total.
          </p>
        </section>
      ) : null}

      {compared && !loading && items.length > 0 && stores.length === 0 && !error ? (
        <p className="text-xs text-muted-foreground m-0">
          Nenhum mercado com ofertas para essa lista agora. Tente nomes mais genéricos (ex. &quot;arroz 5kg&quot; →
          &quot;arroz&quot;).
        </p>
      ) : null}

      {compared && !loading && matchedItems.length > 0 ? (
        <section>
          <h3 className="text-sm font-bold text-foreground m-0 mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" aria-hidden />
            Melhor preço por produto
          </h3>
          <ul className="space-y-2 list-none p-0 m-0">
            {matchedItems.map((row) => (
              <li
                key={row.listItemId || row.listName}
                className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-subtle"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-foreground m-0">{row.listName}</p>
                  <span className="shrink-0 text-sm font-black text-primary">
                    {formatBrl(row.bestOffer?.preco)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 m-0">{row.bestOffer?.nome_loja || 'Mercado'}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              if (typeof onOpenMap === 'function') onOpenMap(mapUrl);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-3 text-sm font-bold text-primary hover:bg-primary/15"
          >
            <MapPin className="h-4 w-4" aria-hidden />
            Ver lista no mapa
          </button>
          {typeof onOpenRota === 'function' ? (
            <button
              type="button"
              onClick={onOpenRota}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              Ir para Rota de Compras (estoque)
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

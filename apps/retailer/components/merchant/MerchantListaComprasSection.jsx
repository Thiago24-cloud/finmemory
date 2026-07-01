'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, Plus, Store, Tag, Trash2, X } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { buildConsumerMapUrl } from '../../lib/consumerAppUrl';

const STORAGE_KEY = 'finmemory_parceiros_lista_compras_v1';

function formatBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function loadStoredItems() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((s) => String(s || '').trim()).filter((n) => n.length >= 2).slice(0, 24)
      : [];
  } catch {
    return [];
  }
}

export function MerchantListaComprasSection({ storeLat, storeLng, onOpenMap }) {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expandedStore, setExpandedStore] = useState(null);

  useEffect(() => {
    setItems(loadStoredItems());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const namesKey = items.join('|');

  const fetchCompare = useCallback(async () => {
    if (!namesKey) {
      setData(null);
      setError('');
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
        return;
      }
      setData(json);
    } catch {
      setError('Erro de rede ao buscar preços.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [items, namesKey]);

  useEffect(() => {
    const t = window.setTimeout(() => void fetchCompare(), 500);
    return () => window.clearTimeout(t);
  }, [fetchCompare]);

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
    const parts = draft
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((n) => n.length >= 2);
    if (parts.length === 0) return;
    setItems((prev) => {
      const seen = new Set(prev.map((n) => n.toLowerCase()));
      const next = [...prev];
      for (const p of parts) {
        const key = p.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(p);
        if (next.length >= 24) break;
      }
      return next;
    });
    setDraft('');
  };

  const removeItem = (name) => {
    setItems((prev) => prev.filter((n) => n !== name));
  };

  const stores = data?.stores || [];
  const matchedItems = (data?.items || []).filter((i) => i.matched);
  const summary = data?.summary;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold m-0 text-white">Lista de compras</h2>
        <p className="text-xs text-white/50 mt-2 m-0 leading-relaxed">
          Monte o que você precisa repor (arroz, sabão, frutas…) e veja o preço de cada item e o{' '}
          <strong className="text-white/70">total por supermercado</strong> com base nas ofertas ativas no mapa.
        </p>
      </div>

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
          placeholder="Ex.: arroz, pera, sabão em pó"
          className="flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-[#39FF14]/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={addItemsFromDraft}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-bold text-[#050508] hover:brightness-110"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar
        </button>
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
          {items.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] pl-3 pr-1.5 py-1 text-xs font-semibold text-white"
            >
              {name}
              <button
                type="button"
                onClick={() => removeItem(name)}
                className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label={`Remover ${name}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-white/40 m-0">Adicione pelo menos um produto para comparar preços.</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/60 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#39FF14]" aria-hidden />
          Buscando preços no mapa…
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 m-0" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && summary && items.length > 0 ? (
        <p className="text-xs font-semibold text-[#39FF14] m-0">
          {summary.matched}/{summary.total} itens com oferta
          {summary.storesCount > 0 ? ` · ${summary.storesCount} mercado(s)` : ''}
        </p>
      ) : null}

      {!loading && stores.length > 0 ? (
        <section>
          <h3 className="text-sm font-bold text-white/90 m-0 mb-3 flex items-center gap-2">
            <Store className="h-4 w-4 text-[#39FF14]" aria-hidden />
            Total por supermercado
          </h3>
          <ul className="space-y-3 list-none p-0 m-0">
            {stores.map((store) => {
              const isOpen = expandedStore === store.storeName;
              return (
                <li
                  key={store.storeId || store.storeName}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedStore(isOpen ? null : store.storeName)}
                    className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white m-0 truncate">{store.storeName}</p>
                      <p className="text-[11px] text-white/45 mt-1 m-0">
                        {store.coveredItems}/{store.totalItems} itens da lista · {store.coveragePct}% cobertura
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-black text-[#39FF14]">{formatBrl(store.total)}</span>
                  </button>
                  {isOpen ? (
                    <ul className="border-t border-white/10 px-4 py-2 space-y-1.5 list-none m-0">
                      {store.lines.map((line) => (
                        <li
                          key={`${store.storeName}-${line.listName}`}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-white/80 truncate">
                            {line.listName}
                            {line.productName &&
                            line.productName.toLowerCase() !== line.listName.toLowerCase() ? (
                              <span className="text-white/40"> · {line.productName}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 font-semibold text-white">{formatBrl(line.price)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="text-[10px] text-white/35 mt-2 m-0">
            Total = soma do melhor preço de cada item encontrado naquele mercado. Itens sem oferta não entram no total.
          </p>
        </section>
      ) : null}

      {!loading && items.length > 0 && stores.length === 0 && !error ? (
        <p className="text-xs text-white/50 m-0">
          Nenhum mercado com ofertas para essa lista agora. Tente nomes mais genéricos (ex. &quot;arroz 5kg&quot; →
          &quot;arroz&quot;).
        </p>
      ) : null}

      {!loading && matchedItems.length > 0 ? (
        <section>
          <h3 className="text-sm font-bold text-white/90 m-0 mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#39FF14]" aria-hidden />
            Melhor preço por produto
          </h3>
          <ul className="space-y-2 list-none p-0 m-0">
            {matchedItems.map((row) => (
              <li
                key={row.listItemId || row.listName}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-white m-0">{row.listName}</p>
                  <span className="shrink-0 text-sm font-black text-[#39FF14]">
                    {formatBrl(row.bestOffer?.preco)}
                  </span>
                </div>
                <p className="text-[11px] text-white/45 mt-1 m-0">{row.bestOffer?.nome_loja || 'Mercado'}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {items.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            if (typeof onOpenMap === 'function') onOpenMap(mapUrl);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#39FF14]/40 bg-[#39FF14]/10 py-3 text-sm font-bold text-[#39FF14] hover:bg-[#39FF14]/15"
        >
          <MapPin className="h-4 w-4" aria-hidden />
          Ver lista no mapa
        </button>
      ) : null}
    </div>
  );
}

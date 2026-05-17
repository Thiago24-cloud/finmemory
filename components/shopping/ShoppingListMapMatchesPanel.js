'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, MapPin, Store, Tag } from 'lucide-react';
import { cn } from '../../lib/utils';

function formatBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Mostra quais itens da lista têm oferta ativa no mapa de preços.
 */
export function ShoppingListMapMatchesPanel({ listItems, mapHref, isRetailer = false }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const namesKey = (listItems || [])
    .map((i) => String(i.name || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|');

  useEffect(() => {
    if (!namesKey) {
      setData(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = listItems
          .map((i) => String(i.name || '').trim())
          .filter((n) => n.length >= 2)
          .slice(0, 24)
          .join(',');
        const res = await fetch(`/api/shopping-list/map-matches?names=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || 'Não foi possível comparar com o mapa.');
          setData(null);
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError('Erro de rede ao buscar ofertas.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [namesKey, listItems]);

  if (!namesKey) return null;

  const summary = data?.summary;
  const matchedItems = (data?.items || []).filter((i) => i.matched);
  const unmatchedItems = (data?.items || []).filter((i) => !i.matched);

  return (
    <section className="mb-6 rounded-2xl border border-primary/25 bg-card p-4 ring-1 ring-primary/10 shadow-[0_0_32px_-16px_hsl(var(--primary)/0.35)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-foreground m-0 flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" aria-hidden />
            {isRetailer ? 'Reposição × mapa' : 'Sua lista × mapa'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 m-0 leading-relaxed">
            {isRetailer
              ? 'Produtos da sua lista que aparecem em promoções nos mercados cadastrados.'
              : 'Itens da lista que batem com ofertas ativas no mapa de preços.'}
          </p>
        </div>
        {loading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" /> : null}
      </div>

      {error ? <p className="text-xs text-red-400 m-0">{error}</p> : null}

      {!loading && summary ? (
        <p className="text-xs font-semibold text-primary m-0 mb-3">
          {summary.matched}/{summary.total} itens com oferta
          {summary.storesCount > 0 ? ` · ${summary.storesCount} mercado(s)` : ''}
        </p>
      ) : null}

      {!loading && matchedItems.length > 0 ? (
        <ul className="space-y-2 mb-3">
          {matchedItems.map((row) => (
            <li
              key={row.listItemId || row.listName}
              className="rounded-xl border border-primary/20 bg-background/80 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-foreground m-0">{row.listName}</p>
                <span className="shrink-0 text-sm font-black text-primary">
                  {formatBrl(row.bestOffer?.preco)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 m-0 flex items-center gap-1">
                <Store className="h-3 w-3 shrink-0" aria-hidden />
                {row.bestOffer?.nome_loja || 'Mercado'}
                {row.offersCount > 1 ? (
                  <span className="text-primary/80"> · +{row.offersCount - 1} oferta(s)</span>
                ) : null}
              </p>
              {row.bestOffer?.produto_nome &&
              row.bestOffer.produto_nome.toLowerCase() !== row.listName.toLowerCase() ? (
                <p className="text-[10px] text-muted-foreground/80 mt-0.5 m-0 line-clamp-1">
                  no mapa: {row.bestOffer.produto_nome}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && summary && summary.matched === 0 && !error ? (
        <p className="text-xs text-muted-foreground m-0 mb-3">
          Nenhum item bateu com ofertas ativas agora. Tente nomes mais genéricos (ex.: &quot;arroz&quot;) ou abra o
          mapa para pesquisar.
        </p>
      ) : null}

      {!loading && unmatchedItems.length > 0 && summary?.matched > 0 ? (
        <p className="text-[10px] text-muted-foreground m-0 mb-3">
          Sem oferta no mapa: {unmatchedItems.map((i) => i.listName).join(', ')}
        </p>
      ) : null}

      <Link
        href={mapHref || '/mapa'}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold no-underline',
          'border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
        )}
      >
        <MapPin className="h-4 w-4" aria-hidden />
        Ver no mapa e planejar rota
      </Link>
    </section>
  );
}

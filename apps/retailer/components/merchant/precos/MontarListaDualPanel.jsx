'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Grid2x2, Minus, Plus, X } from 'lucide-react';

const RADIUS_STEPS = [
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '20 km', value: 20 },
  { label: 'Tudo', value: 0 },
];

function formatBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function RadiusSlider({ value, onChange }) {
  const idx = Math.max(
    0,
    RADIUS_STEPS.findIndex((s) => s.value === value)
  );
  const safeIdx = idx === -1 ? RADIUS_STEPS.length - 1 : idx;
  const pct = (safeIdx / (RADIUS_STEPS.length - 1)) * 100;

  return (
    <div className="px-1 pb-1">
      <div className="relative h-6 flex items-center">
        <div className="w-full h-1.5 rounded-full bg-white/10 relative">
          <div
            className="absolute h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${pct}%` }}
          />
          {RADIUS_STEPS.map((_, i) => (
            <div
              key={i}
              className="absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-[#0d1b2e]"
              style={{
                left: `${(i / (RADIUS_STEPS.length - 1)) * 100}%`,
                transform: 'translate(-50%, -50%)',
                background: i <= safeIdx ? '#22c55e' : '#52525b',
              }}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={RADIUS_STEPS.length - 1}
          step={1}
          value={safeIdx}
          onChange={(e) => onChange(RADIUS_STEPS[Number(e.target.value)].value)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          aria-label="Raio de busca"
        />
      </div>
      <div className="flex justify-between mt-0.5">
        {RADIUS_STEPS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onChange(s.value)}
            className={`text-[10px] transition-colors ${
              i === safeIdx ? 'text-green-400 font-bold' : 'text-white/40'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Painel dual do modo "Montar lista" — só UI do bottom sheet do mapa.
 * Não altera Catálogo nem outras abas.
 */
export function MontarListaDualPanel({
  items,
  qtyByName,
  onAddItem,
  onRemoveItem,
  onQtyChange,
  searchTerm,
  onSearchTermChange,
  listCompare,
  listCompareLoading,
  origin,
  radiusKm,
  onRadiusChange,
  selectedStoreName,
  onSelectStore,
  onViewItems,
}) {
  const inputRef = useRef(null);
  const [openPricesFor, setOpenPricesFor] = useState(null);
  const [expandedStoreKey, setExpandedStoreKey] = useState(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!openPricesFor) return undefined;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpenPricesFor(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openPricesFor]);

  const commit = () => {
    const trimmed = String(searchTerm || '').trim();
    if (trimmed.length < 2) return;
    onAddItem(trimmed);
    onSearchTermChange('');
    inputRef.current?.focus();
  };

  const storePricesByItem = useMemo(() => {
    const map = new Map();
    const grouped = listCompare?.items || [];
    for (const g of grouped) {
      const key = String(g.listName || '').toLowerCase();
      map.set(
        key,
        (g.offers || []).map((o) => ({
          storeName: o.nome_loja,
          price: o.preco,
        }))
      );
    }
    return map;
  }, [listCompare]);

  const rankings = useMemo(() => {
    const stores = listCompare?.stores || [];
    if (!stores.length) return [];

    const withTotals = stores.map((store) => {
      let totalCost = 0;
      const availableNames = [];
      const lineByName = new Map();
      for (const line of store.lines || []) {
        const key = String(line.listName || '').toLowerCase();
        if (!key) continue;
        const qty = Math.max(1, Number(qtyByName[line.listName]) || 1);
        const unit = Number(line.price);
        if (Number.isFinite(unit) && unit > 0) {
          totalCost += unit * qty;
          availableNames.push(line.listName);
          lineByName.set(key, line);
        }
      }
      const availableCount = availableNames.length;
      const totalCount = items.length;
      const missing = Math.max(0, totalCount - availableCount);
      const availableSet = new Set(availableNames.map((n) => n.toLowerCase()));
      const missingNames = items.filter((n) => !availableSet.has(String(n).toLowerCase()));

      const itemRows = items.map((listName) => {
        const qty = Math.max(1, Number(qtyByName[listName]) || 1);
        const match = lineByName.get(String(listName).toLowerCase());
        if (match) {
          const unit = Number(match.price);
          return {
            listName,
            qty,
            available: true,
            productName: match.productName || listName,
            unitPrice: unit,
            lineTotal: Number((unit * qty).toFixed(2)),
          };
        }
        return {
          listName,
          qty,
          available: false,
          productName: null,
          unitPrice: null,
          lineTotal: null,
        };
      });

      let distanceKm = null;
      if (
        origin &&
        Number.isFinite(Number(store.lat)) &&
        Number.isFinite(Number(store.lng))
      ) {
        const R = 6371;
        const dLat = ((Number(store.lat) - origin.lat) * Math.PI) / 180;
        const dLng = ((Number(store.lng) - origin.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((origin.lat * Math.PI) / 180) *
            Math.cos((Number(store.lat) * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      return {
        ...store,
        totalCost: Number(totalCost.toFixed(2)),
        availableCount,
        totalCount,
        missing,
        availableNames,
        missingNames,
        itemRows,
        distanceKm,
      };
    });

    let filtered = withTotals;
    if (radiusKm > 0 && origin) {
      filtered = withTotals.filter(
        (s) => s.distanceKm != null && s.distanceKm <= radiusKm
      );
    }

    return filtered.sort((a, b) => {
      if (a.availableCount !== b.availableCount) {
        return b.availableCount - a.availableCount;
      }
      return a.totalCost - b.totalCost;
    });
  }, [listCompare, qtyByName, items, origin, radiusKm]);

  return (
    <div className="flex flex-1 min-h-0 divide-x divide-white/10" style={{ minHeight: 280 }}>
      {/* Minha Cesta */}
      <div className="flex flex-col w-1/2 min-h-0 min-w-0">
        <div className="px-3 py-2 border-b border-white/10 shrink-0">
          <h2 className="text-white font-bold text-sm m-0">Minha Cesta</h2>
        </div>
        <div className="px-2 pt-2 pb-1 flex gap-1.5 shrink-0">
          <input
            ref={inputRef}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
            placeholder="Digite o produto e dê Enter..."
            className="flex-1 min-w-0 bg-white/5 border border-green-500/60 rounded-lg px-2.5 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-green-400"
          />
          <button
            type="button"
            onClick={commit}
            disabled={String(searchTerm || '').trim().length < 2}
            className="shrink-0 w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center disabled:opacity-40"
            aria-label="Adicionar produto"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {items.length === 0 ? (
            <p className="text-white/40 text-xs text-center pt-6 px-2 m-0">
              Nenhum item adicionado ainda.
            </p>
          ) : (
            items.map((name) => {
              const qty = Math.max(1, Number(qtyByName[name]) || 1);
              const prices = storePricesByItem.get(name.toLowerCase()) || [];
              const isOpen = openPricesFor === name;
              const unitPrices = prices
                .map((p) => Number(p.price))
                .filter((n) => Number.isFinite(n) && n > 0);
              const bestUnit = unitPrices.length ? Math.min(...unitPrices) : null;
              const lineTotal =
                bestUnit != null ? Number((bestUnit * qty).toFixed(2)) : null;
              return (
                <div key={name} className="relative">
                  <div className="flex items-center gap-1 py-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 bg-green-600 text-white text-[11px] font-medium px-2 py-0.5 rounded-full max-w-[100px]">
                      <span className="truncate">{name}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(name)}
                        className="shrink-0 opacity-80 hover:opacity-100"
                        aria-label={`Remover ${name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                    <div className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onQtyChange(name, qty - 1)}
                        disabled={qty <= 1}
                        className="w-6 h-6 rounded bg-white/10 text-white flex items-center justify-center disabled:opacity-40"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center text-xs text-white font-medium">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onQtyChange(name, qty + 1)}
                        className="w-6 h-6 rounded bg-white/10 text-white flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="ml-auto text-right leading-tight min-w-[64px]">
                      {lineTotal != null ? (
                        <>
                          <div className="text-[11px] font-bold text-green-400">
                            {formatBrl(lineTotal)}
                          </div>
                          <div className="text-[9px] text-white/40">
                            {formatBrl(bestUnit)}/un
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] text-white/35">R$ —</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenPricesFor(isOpen ? null : name)}
                      className="text-[10px] text-white/45 hover:text-green-400 inline-flex items-center gap-0.5"
                    >
                      Preços
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                  {isOpen ? (
                    <div
                      ref={popoverRef}
                      className="absolute left-0 right-0 z-20 bg-[#1a2332] border border-white/15 rounded-lg shadow-xl p-2 text-xs"
                    >
                      <div className="text-white/45 font-medium mb-1.5 uppercase tracking-wide text-[10px]">
                        Preços individuais — {name} (qtd {qty})
                      </div>
                      {!prices.length ? (
                        <p className="text-white/40 m-0 text-[11px]">
                          Sem preços ainda. Aguarde a comparação.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {prices.map((sp, i) => {
                            const unit = Number(sp.price);
                            const line = Number.isFinite(unit)
                              ? Number((unit * qty).toFixed(2))
                              : null;
                            return (
                              <div
                                key={`${sp.storeName}-${i}`}
                                className="flex justify-between items-center gap-2"
                              >
                                <span className="text-white/70 truncate">
                                  {sp.storeName}
                                </span>
                                <span className="shrink-0 text-right leading-tight">
                                  <span className="font-bold text-white block">
                                    {line != null ? formatBrl(line) : '—'}
                                  </span>
                                  <span className="text-[9px] text-white/40">
                                    {Number.isFinite(unit) ? `${formatBrl(unit)}/un` : ''}
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Comparativo */}
      <div className="flex flex-col w-1/2 min-h-0 min-w-0">
        <div className="px-3 py-2 border-b border-white/10 shrink-0">
          <h2 className="text-white font-bold text-[11px] leading-tight m-0">
            Comparativo Total &amp; Sugestões
          </h2>
          <p className="text-white/40 text-[10px] m-0 mt-0.5">
            Total da Cesta em Mercados da Região
          </p>
        </div>
        <div className="pt-2 px-1 shrink-0">
          <RadiusSlider value={radiusKm} onChange={onRadiusChange} />
        </div>
        <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-1">
          {items.length === 0 ? (
            <p className="text-white/40 text-xs text-center pt-6 px-2 m-0">
              Adicione produtos na cesta para ver o comparativo.
            </p>
          ) : listCompareLoading ? (
            <p className="text-white/40 text-xs text-center pt-6 px-2 m-0">
              Calculando preços...
            </p>
          ) : rankings.length === 0 ? (
            <p className="text-white/40 text-xs text-center pt-6 px-2 m-0">
              Nenhuma loja no raio selecionado.
            </p>
          ) : (
            rankings.map((r, i) => {
              const isCheapest = i === 0 && r.availableCount > 0;
              const storeKey = String(r.storeId || r.storeName);
              const isSelected = selectedStoreName === r.storeName;
              const isExpanded = expandedStoreKey === storeKey;
              return (
                <div
                  key={storeKey}
                  className={`rounded-lg transition-colors overflow-hidden ${
                    isCheapest
                      ? 'bg-green-600/20 border border-green-600/40'
                      : isSelected || isExpanded
                        ? 'bg-white/10 border border-white/25'
                        : 'bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() => onSelectStore?.(r)}
                      className="flex flex-1 min-w-0 items-center gap-2 text-left"
                    >
                      <div className="shrink-0 w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white font-bold text-xs">
                        {String(r.storeName || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-[11px] uppercase tracking-wide truncate leading-tight">
                          {r.storeName}
                        </div>
                        <div className="text-white/70 text-[10px] leading-tight mt-0.5">
                          {r.availableCount} de {r.totalCount}{' '}
                          {r.totalCount === 1 ? 'produto' : 'produtos'}
                        </div>
                        {r.missing > 0 ? (
                          <div className="text-orange-400 text-[10px] leading-tight mt-0.5">
                            Falta {r.missing}{' '}
                            {r.missing === 1 ? 'item' : 'itens'}
                          </div>
                        ) : (
                          <div className="text-green-500/80 text-[10px] leading-tight mt-0.5">
                            Cesta completa
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={`font-bold text-sm leading-tight ${
                            isCheapest ? 'text-green-400' : 'text-white'
                          }`}
                        >
                          {formatBrl(r.totalCost)}
                        </div>
                        <div className="text-white/40 text-[10px] leading-tight">
                          {r.distanceKm != null
                            ? `${r.distanceKm.toFixed(1)} km`
                            : '—'}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = isExpanded ? null : storeKey;
                        setExpandedStoreKey(next);
                        onViewItems?.(r);
                        onSelectStore?.(r);
                      }}
                      className={`shrink-0 inline-flex items-center gap-0.5 text-[9px] border rounded px-1.5 py-1 transition-colors ${
                        isExpanded
                          ? 'border-green-500 text-green-400'
                          : 'text-white/45 border-white/15 hover:border-green-500 hover:text-green-400'
                      }`}
                    >
                      <Grid2x2 className="w-3 h-3" />
                      Ver
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="border-t border-white/10 bg-black/20 px-2.5 py-2 space-y-2">
                      {(r.itemRows || []).map((row) => (
                        <div
                          key={row.listName}
                          className="flex items-start justify-between gap-2 text-[11px]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-medium">
                              {row.qty}x {row.listName}
                            </div>
                            {row.available ? (
                              <div className="text-white/45 text-[10px] mt-0.5 leading-snug">
                                {row.productName}
                                {row.unitPrice != null
                                  ? ` (${formatBrl(row.unitPrice)} / un)`
                                  : ''}
                              </div>
                            ) : null}
                          </div>
                          <div className="shrink-0 text-right">
                            {row.available ? (
                              <span className="font-bold text-white">
                                {formatBrl(row.lineTotal)}
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-medium text-white/50 bg-white/10 px-2 py-0.5 rounded">
                                Não disponível
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

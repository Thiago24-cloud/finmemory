'use client';

import { memo } from 'react';
import { ArrowDown, MapPin, Navigation, ShoppingCart, Star } from 'lucide-react';

function formatBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function SkipStoreCardImpl({
  name,
  color,
  price,
  address,
  isLowest,
  savingsPercent,
  savingsAmount,
  isSelected,
  isFavorite,
  isOpportunity,
  onSelect,
  onAddToList,
  onNavigate,
  onToggleFavorite,
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={`rounded-2xl border p-3 transition-all cursor-pointer ${
        isSelected
          ? 'border-[#39FF14] bg-[#39FF14]/10 ring-2 ring-[#39FF14]/30'
          : isOpportunity
            ? 'border-green-500/40 bg-green-500/5'
            : isLowest
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md relative text-lg font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {name[0]}
          {isFavorite ? (
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
              <Star className="w-3 h-3 text-yellow-900 fill-yellow-900" />
            </div>
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm truncate text-white">{name}</span>
            {isOpportunity ? (
              <span className="text-[9px] uppercase font-bold bg-green-600 text-white px-1.5 py-0.5 rounded">
                Oportunidade
              </span>
            ) : null}
            {isLowest && !isOpportunity ? (
              <span className="text-[9px] uppercase font-bold bg-green-600/80 text-white px-1.5 py-0.5 rounded">
                Melhor
              </span>
            ) : null}
          </div>
          {address ? (
            <p className="text-[10px] text-white/45 m-0 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {address}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="shrink-0 p-1.5 rounded-full hover:bg-white/10"
          aria-label="Favoritar mercado"
        >
          <Star className={`w-5 h-5 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-white/40'}`} />
        </button>
        <div className="text-right shrink-0">
          <div className={`text-lg font-bold ${isOpportunity || isLowest ? 'text-[#39FF14]' : 'text-white'}`}>
            {formatBrl(price)}
          </div>
          {savingsAmount > 0 ? (
            <div className="flex items-center justify-end text-[10px] font-medium text-green-400">
              <ArrowDown className="w-3 h-3 mr-0.5" />
              {savingsPercent.toFixed(0)}%
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddToList();
          }}
          className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#39FF14] text-[#050508] text-sm font-bold"
        >
          <ShoppingCart className="w-4 h-4" />
          Adicionar à lista
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
          className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg border border-white/20 text-white text-sm"
        >
          <Navigation className="w-4 h-4" />
          Ir
        </button>
      </div>
    </div>
  );
}

export const SkipStoreCard = memo(SkipStoreCardImpl);

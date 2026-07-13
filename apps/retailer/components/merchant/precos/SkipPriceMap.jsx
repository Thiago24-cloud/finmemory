'use client';

import { memo } from 'react';
import { LocateFixed, Minus, Plus, Star } from 'lucide-react';

function formatBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

function SkipPriceMapImpl({
  stores,
  selectedStore,
  onSelectStore,
  productName,
  onLocateMe,
  isLocating,
}) {
  return (
    <div className="fixed inset-0 w-full h-full bg-[#0d1b2e]">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <pattern id="fmMapGrid" width="35" height="35" patternUnits="userSpaceOnUse">
            <path d="M 35 0 L 0 0 0 35" fill="none" stroke="#152a45" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="fmMapGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#152540" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0d1b2e" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="#0d1b2e" />
        <rect width="100%" height="100%" fill="url(#fmMapGrid)" />
        <rect width="100%" height="100%" fill="url(#fmMapGlow)" />
        <line x1="0" y1="25%" x2="100%" y2="30%" stroke="#1f3a5f" strokeWidth="5" opacity="0.7" />
        <line x1="0" y1="70%" x2="100%" y2="65%" stroke="#1f3a5f" strokeWidth="5" opacity="0.7" />
        <line x1="30%" y1="0" x2="35%" y2="100%" stroke="#1f3a5f" strokeWidth="5" opacity="0.7" />
        <line x1="75%" y1="0" x2="70%" y2="100%" stroke="#1f3a5f" strokeWidth="5" opacity="0.7" />
      </svg>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5]">
        <div className="relative flex items-center justify-center">
          <div
            className={cn(
              'absolute w-10 h-10 bg-blue-500/20 rounded-full',
              isLocating ? 'animate-ping' : 'animate-pulse'
            )}
          />
          <div className="w-4 h-4 bg-blue-500 rounded-full ring-2 ring-white/60 shadow-lg border-2 border-white" />
        </div>
      </div>

      {stores.map((store) => {
        const isSelected = selectedStore === store.name;
        return (
          <button
            key={store.name}
            type="button"
            className="absolute -translate-x-1/2 -translate-y-full transition-all duration-300 z-10 group"
            style={{ left: `${store.x}%`, top: `${store.y}%` }}
            onClick={() => onSelectStore(store.name)}
          >
            <div
              className={cn(
                'mb-2 px-2.5 py-1 rounded-lg text-white text-xs font-bold shadow-xl whitespace-nowrap relative',
                store.isOpportunity ? 'bg-green-600' : 'bg-blue-600',
                isSelected ? 'scale-110 ring-2 ring-white' : 'opacity-95 group-hover:scale-105'
              )}
            >
              {formatBrl(store.price)}
            </div>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center border-2 shadow-lg relative',
                  isSelected ? 'scale-125 border-white' : 'border-white/80'
                )}
                style={{ backgroundColor: store.color }}
              >
                <span className="text-[11px] font-bold text-white">{store.name[0]}</span>
                {store.isFavorite ? (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                    <Star className="w-2.5 h-2.5 text-yellow-900 fill-yellow-900" />
                  </div>
                ) : null}
              </div>
            </div>
            <div className={cn('text-[9px] font-semibold text-center mt-0.5', isSelected ? 'text-white' : 'text-white/50')}>
              {store.name}
            </div>
          </button>
        );
      })}

      <div className="absolute top-16 right-3 flex flex-col gap-1 z-20 pointer-events-none opacity-40">
        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
          <Plus className="w-4 h-4 text-white" />
        </div>
        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
          <Minus className="w-4 h-4 text-white" />
        </div>
      </div>

      <button
        type="button"
        onClick={onLocateMe}
        className="absolute top-16 left-3 w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20 shadow-md z-20"
        aria-label="Minha localização"
      >
        <LocateFixed className={cn('w-5 h-5 text-[#39FF14]', isLocating && 'animate-spin')} />
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/50 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10 max-w-[70%]">
        <p className="text-xs font-bold text-white truncate m-0">{productName}</p>
      </div>
    </div>
  );
}

export const SkipPriceMap = memo(SkipPriceMapImpl);

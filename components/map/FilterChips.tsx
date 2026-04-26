'use client';

import type { ReactNode } from 'react';

export type FilterChipItem = {
  id: string;
  label: string;
  icon?: ReactNode;
};

type FilterChipsProps = {
  chips: FilterChipItem[];
  activeChipId: string;
  onChange: (chipId: string) => void;
  className?: string;
  ariaLabel?: string;
};

export default function FilterChips({
  chips,
  activeChipId,
  onChange,
  className = '',
  ariaLabel = 'Filtros',
}: FilterChipsProps) {
  return (
    <div
      className={`scrollbar-hide overflow-x-auto overscroll-x-contain pb-2 ${className}`.trim()}
      style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}
      data-sheet-no-drag
      aria-label={ariaLabel}
      role="tablist"
    >
      <div className="flex w-max items-center gap-2 px-0.5">
        {chips.map((chip) => {
          const active = chip.id === activeChipId;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onChange(chip.id)}
              role="tab"
              aria-selected={active}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? 'border-emerald-400/50 bg-[#1a1a1a] text-zinc-100 shadow-[0_0_0_1px_rgba(16,185,129,0.22)]'
                  : 'border-zinc-700/80 bg-[#0f0f0f] text-zinc-300 hover:border-zinc-500 hover:text-zinc-100'
              }`}
              style={{ touchAction: 'manipulation' }}
            >
              {chip.icon ? <span className="text-sm leading-none">{chip.icon}</span> : null}
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { CreditCard, LineChart } from 'lucide-react';
import { cn } from '../../lib/utils';

/** @typedef {'fluxo' | 'cartoes'} SimuladorMainTab */

/**
 * Abas principais do simulador: fluxo de passos vs limites de cartão.
 */
export function SimuladorMainTabs({ active = 'fluxo', onChange }) {
  const tabs = [
    { id: 'fluxo', label: 'Simulação', icon: LineChart },
    { id: 'cartoes', label: 'Cartões', icon: CreditCard },
  ];

  return (
    <div
      className="flex rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-0.5 gap-0.5"
      role="tablist"
      aria-label="Secções do simulador"
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const on = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange?.(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 rounded-md py-2 text-[11px] font-medium transition-colors',
              on ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

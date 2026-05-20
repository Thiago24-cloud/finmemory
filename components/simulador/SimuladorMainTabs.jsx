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
      className="flex rounded-xl border border-zinc-800 bg-zinc-950/80 p-1 gap-1"
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
              'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition-colors',
              on
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

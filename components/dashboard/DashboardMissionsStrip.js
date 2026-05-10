'use client';

import Link from 'next/link';
import { Swords } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMissionsToday } from '../missions/MissionsTodayContext';

/**
 * Barra fina de progresso — só visual (completed/total). Liga a /missoes.
 */
export function DashboardMissionsProgress({ completed, total, className }) {
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <Link
      href="/missoes"
      className={cn(
        'block rounded-lg px-1 py-0.5 -mx-1 no-underline outline-none',
        'focus-visible:ring-2 focus-visible:ring-[#00E676]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1E2E]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8899AA] uppercase tracking-wide">
          <Swords className="h-3 w-3 text-amber-400/90 shrink-0" aria-hidden />
          Missões hoje
        </span>
        <span className="text-[11px] font-bold tabular-nums text-[#F0F4FF]">
          {completed}/{total}
        </span>
      </div>
      <div
        className="h-1 rounded-full bg-white/10 overflow-hidden"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Missões concluídas: ${completed} de ${total}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-[#00E676] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}

/**
 * Versão que lê o mesmo estado que BottomNav / dashboard (MissionsTodayProvider).
 */
export function DashboardMissionsStrip({ className }) {
  const { missions } = useMissionsToday();
  if (!missions?.length) return null;
  const completed = missions.filter((m) => m.completed).length;
  return (
    <DashboardMissionsProgress completed={completed} total={missions.length} className={className} />
  );
}

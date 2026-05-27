'use client';

import { cn } from '../../lib/utils';

const XP_PER_LEVEL = 100;

/**
 * XPBar — barra de progresso de XP com nível e streak.
 * Segue o design system do FinMemory (verde #2ECC49, fundo branco).
 */
export function XPBar({ xp = 0, level = 1, streak = 0, className }) {
  const xpInLevel = xp % XP_PER_LEVEL;
  const pct = Math.min(100, Math.round((xpInLevel / XP_PER_LEVEL) * 100));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Nível */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-[11px]"
        style={{ background: 'linear-gradient(135deg, #2ECC49, #16a34a)', boxShadow: '0 0 10px rgba(46,204,73,0.4)' }}
        aria-label={`Nível ${level}`}
      >
        {level}
      </div>

      {/* Barra */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] font-bold text-[#2ECC49]">{xp} XP</span>
          <span className="text-[10px] text-muted-foreground">nível {level + 1} em {(level * XP_PER_LEVEL)} XP</span>
        </div>
        <div className="h-1.5 bg-[#e8f5e9] dark:bg-[#1E2A3A] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #2ECC49, #16a34a)', boxShadow: '0 0 6px rgba(46,204,73,0.5)' }}
            role="progressbar"
            aria-valuenow={xpInLevel}
            aria-valuemax={XP_PER_LEVEL}
          />
        </div>
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div
          className="flex-shrink-0 flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1"
          aria-label={`Sequência de ${streak} dias`}
        >
          <span className="text-sm leading-none">🔥</span>
          <span className="text-[12px] font-black text-amber-600">{streak}</span>
        </div>
      )}
    </div>
  );
}

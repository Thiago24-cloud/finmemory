'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/Sheet';
import { cn } from '../../lib/utils';

function ProgressBar({ pct, color = '#2ECC49' }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function StatesUnlockPanel({ open, onClose }) {
  const [states, setStates] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/map/states-progress')
      .then((r) => r.ok ? r.json() : { states: [], total_users: 0 })
      .then((d) => {
        setStates(d.states || []);
        setTotalUsers(d.total_users || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const nextLocked = states.find((s) => !s.unlocked);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl px-5 pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-[17px] font-black tracking-tight">Mapa de Estados</SheetTitle>
          <p className="text-sm text-muted-foreground -mt-1">
            Desbloqueie regiões à medida que a comunidade cresce
          </p>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#2ECC49] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Banner próximo desbloqueio */}
            {nextLocked && (
              <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                  Próximo desbloqueio
                </p>
                <div className="flex justify-between items-center mb-2">
                  <p className="font-black text-[15px]">🔒 {nextLocked.name}</p>
                  <p className="text-[12px] font-bold text-amber-600">
                    {totalUsers} / {nextLocked.needed} usuários
                  </p>
                </div>
                <ProgressBar pct={nextLocked.progress_pct} color="linear-gradient(90deg, #f59e0b, #d97706)" />
              </div>
            )}

            {/* Lista de estados */}
            <div className="flex flex-col gap-3">
              {states.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'rounded-2xl border p-4 transition-all',
                    s.unlocked
                      ? 'border-[#2ECC49]/30 bg-[#f0fdf4]'
                      : 'border-gray-100 bg-white'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{s.unlocked ? '✅' : '🔒'}</span>
                      <div>
                        <p className={cn('font-bold text-[14px]', s.unlocked ? 'text-[#16a34a]' : 'text-foreground')}>
                          {s.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.unlocked
                            ? `${totalUsers} usuários ativos`
                            : `${totalUsers} / ${s.needed} usuários necessários`}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[12px] font-black',
                        s.unlocked ? 'text-[#2ECC49]' : 'text-amber-500'
                      )}
                    >
                      {s.unlocked ? '100%' : `${s.progress_pct}%`}
                    </span>
                  </div>
                  <ProgressBar
                    pct={s.unlocked ? 100 : s.progress_pct}
                    color={s.unlocked ? '#2ECC49' : '#f59e0b'}
                  />
                </div>
              ))}
            </div>

            <p className="mt-5 text-center text-[12px] text-muted-foreground">
              Convide amigos para desbloquear novos estados mais rápido!
            </p>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

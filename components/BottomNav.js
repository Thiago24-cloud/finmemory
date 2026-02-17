'use client';

import { useRouter } from 'next/router';
import { Map, BarChart3, PlusCircle, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { AddActionSheet } from './AddActionSheet';
import { useState } from 'react';

const tabs = [
  { icon: Map, label: 'Mapas', path: '/mapa', isAction: false },
  { icon: BarChart3, label: 'Gastos', path: '/dashboard', isAction: false },
  { icon: PlusCircle, label: 'Adicionar', path: '__action__', isAction: true },
  { icon: User, label: 'Perfil', path: '/settings', isAction: false },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = router.pathname;
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const handleTabClick = (tab) => {
    if (tab.path === '__action__') {
      setAddSheetOpen(true);
    } else {
      router.push(tab.path);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50 safe-area-bottom">
        <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
          {tabs.map((tab) => {
            const isActive = !tab.isAction && pathname === tab.path;
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => handleTabClick(tab)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all min-w-[60px] relative',
                  tab.isAction && 'relative -mt-4',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.isAction ? (
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 gradient-primary text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                ) : (
                  <Icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
                )}
                <span
                  className={cn(
                    'text-[10px] transition-colors',
                    tab.isAction && 'mt-0.5',
                    isActive ? 'font-bold' : 'font-medium'
                  )}
                >
                  {tab.label}
                </span>
                {isActive && !tab.isAction && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <AddActionSheet open={addSheetOpen} onOpenChange={setAddSheetOpen} />
    </>
  );
}

'use client';

import { useRouter } from 'next/router';
import { Map, BarChart3, CreditCard, User } from 'lucide-react';
import { cn } from '../lib/utils';

const tabs = [
  { icon: Map, label: 'Mapas', path: '/mapa' },
  { icon: BarChart3, label: 'Gastos', path: '/dashboard' },
  { icon: CreditCard, label: 'Cartões', path: '/cartoes' },
  { icon: User, label: 'Perfil', path: '/settings' },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = router.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50 safe-area-bottom">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => router.push(tab.path)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all min-w-[60px] relative',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
              <span
                className={cn(
                  'text-[10px] transition-colors',
                  isActive ? 'font-bold' : 'font-medium'
                )}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

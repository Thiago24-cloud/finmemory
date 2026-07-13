'use client';

import { LogOut, Settings, Store } from 'lucide-react';
import { cn } from '../../../lib/skip/cn';
import { SKIP_NAV_ITEMS } from './skipNavItems';

/**
 * Layout Skip: header sticky + main max-w-2xl + bottom nav scrollável.
 */
export function MerchantSkipShell({
  storeName = 'Minha loja',
  activeTab,
  onTabChange,
  onSignOut,
  mapTabAttention = false,
  children,
  fullBleed = false,
}) {
  return (
    <div className="skip-shell flex flex-col min-h-screen bg-background text-foreground pb-20 md:pb-0">
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight min-w-0">
          <Store className="w-6 h-6 shrink-0" />
          <span className="truncate">{storeName}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
            aria-label="Configurações"
            title="Em breve"
          >
            <Settings className="w-5 h-5" />
          </button>
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
              aria-label="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : null}
        </div>
      </header>

      <main
        className={cn(
          'flex-1 w-full overflow-x-hidden',
          fullBleed ? 'p-0 max-w-none' : 'max-w-2xl mx-auto p-4'
        )}
      >
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-subtle md:relative md:border-t-0 md:bg-transparent md:shadow-none">
        <div className="flex items-center justify-around p-2 max-w-2xl mx-auto overflow-x-auto hide-scrollbar">
          {SKIP_NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const mapPulse = item.id === 'mapa' && mapTabAttention && !isActive;
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center p-2 rounded-lg min-w-[56px] shrink-0 transition-all duration-200',
                  isActive
                    ? 'text-primary scale-105'
                    : mapPulse
                      ? 'text-primary animate-pulse'
                      : 'text-muted-foreground hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={cn('w-6 h-6 mb-1 transition-colors', isActive && 'fill-primary/20')} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Map, BarChart3, User, ScanLine, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { BOTTOM_NAV } from '../lib/appMicrocopy';
import { useMapCart } from './map/MapCartContext';
import { canUseRestrictedFeatures } from '../lib/restrictedFeatureAccess';

export function BottomNav() {
  const router = useRouter();
  const { data: session } = useSession();
  const pathname = router.pathname;
  const { shoppingBagTotals } = useMapCart();
  const bagCount = Number(shoppingBagTotals?.itemsCount || 0);
  const restrictedFeaturesAllowed = canUseRestrictedFeatures(session?.user?.email);
  const mapHref = restrictedFeaturesAllowed ? '/mapa' : '/em-breve';

  const tabBtn = (active) =>
    cn(
      'relative flex flex-col items-center gap-0.5 py-2 rounded-2xl transition-all min-w-[50px] sm:min-w-[56px]',
      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
    );

  const scanActive = pathname === '/add-receipt';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50 safe-area-bottom">
      <div className="max-w-md mx-auto relative flex items-end justify-between h-[4.5rem] px-2 pb-1">
        <div className="flex flex-1 justify-start items-end gap-0.5 sm:gap-1 pl-0.5">
          <button type="button" onClick={() => router.push(mapHref)} className={tabBtn(pathname === '/mapa')}>
            <Map className={cn('h-5 w-5 transition-transform', pathname === '/mapa' && 'scale-110')} />
            {bagCount > 0 ? (
              <span className="absolute -top-1 right-0 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-4 text-white shadow-sm">
                {bagCount > 99 ? '99+' : bagCount}
              </span>
            ) : null}
            <span className={cn('text-[10px]', pathname === '/mapa' ? 'font-bold' : 'font-medium')}>{BOTTOM_NAV.map}</span>
            {pathname === '/mapa' && (
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className={tabBtn(pathname === '/dashboard')}
          >
            <BarChart3
              className={cn('h-5 w-5 transition-transform', pathname === '/dashboard' && 'scale-110')}
            />
            <span className={cn('text-[10px]', pathname === '/dashboard' ? 'font-bold' : 'font-medium')}>
              {BOTTOM_NAV.spending}
            </span>
            {pathname === '/dashboard' && (
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        </div>

        <div className="w-20 shrink-0 pointer-events-none" aria-hidden />

        <div className="flex flex-1 justify-end items-end gap-0.5 sm:gap-1 pr-0.5">
          <button
            type="button"
            onClick={() => router.push('/simulador')}
            className={tabBtn(pathname === '/simulador')}
          >
            <Sparkles className={cn('h-5 w-5 transition-transform', pathname === '/simulador' && 'scale-110')} />
            <span className={cn('text-[9px] sm:text-[10px] leading-tight', pathname === '/simulador' ? 'font-bold' : 'font-medium')}>
              {BOTTOM_NAV.simulador}
            </span>
            {pathname === '/simulador' && (
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push('/settings')}
            className={tabBtn(pathname === '/settings')}
          >
            <User className={cn('h-5 w-5 transition-transform', pathname === '/settings' && 'scale-110')} />
            <span className={cn('text-[10px]', pathname === '/settings' ? 'font-bold' : 'font-medium')}>
              {BOTTOM_NAV.profile}
            </span>
            {pathname === '/settings' && (
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        </div>

        <Link
          href="/add-receipt"
          className={cn(
            'absolute left-1/2 -translate-x-1/2 bottom-[1.1rem] pointer-events-auto',
            'w-[3.65rem] h-[3.65rem] rounded-full flex items-center justify-center',
            'bg-gradient-to-br from-[#34d399] via-[#22c55e] to-[#16a34a] text-white',
            'shadow-[0_10px_28px_rgba(34,197,94,0.45)] ring-4 ring-white',
            'border border-emerald-500/40 hover:brightness-[1.03] active:scale-[0.97] transition-transform',
            scanActive && 'ring-[#bbf7d0] ring-offset-2 ring-offset-white'
          )}
          aria-label={BOTTOM_NAV.scanAria}
        >
          <ScanLine className="h-7 w-7" strokeWidth={2.25} />
        </Link>
      </div>
    </nav>
  );
}

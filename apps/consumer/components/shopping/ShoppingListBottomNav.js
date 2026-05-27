'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { ListOrdered, BarChart3, Map, User, Navigation } from 'lucide-react';
import { cn } from '../../lib/utils';
import { canUseRestrictedFeatures } from '../../lib/restrictedFeatureAccess';
import { useSession } from 'next-auth/react';

/**
 * Barra inferior gamificada — só na página de lista de compras.
 * Paleta alinhada ao DS (primary neon + fundo background).
 */
export function ShoppingListBottomNav({ mapHref = '/mapa' }) {
  const { pathname } = useRouter();
  const { data: session } = useSession();
  const restricted = !canUseRestrictedFeatures(session?.user?.email);
  const mapLink = restricted ? '/em-breve' : mapHref;
  const listasActive = pathname === '/listas' || pathname === '/shopping-list';
  const mapTabActive = pathname === '/mapa';

  const tabInactive = 'text-muted-foreground hover:text-foreground';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-2xl safe-area-bottom shadow-[0_-8px_32px_-12px_hsl(var(--primary)/0.08)]">
      <div className="relative mx-auto flex h-[4.35rem] max-w-md items-end justify-between px-1 pb-1">
        <div className="flex flex-1 items-end justify-start gap-0.5 pl-0.5">
          <Link
            href="/listas"
            className={cn(
              'relative flex min-w-[52px] flex-col items-center gap-1 rounded-xl py-1.5 transition-colors',
              listasActive ? 'text-primary' : tabInactive
            )}
          >
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border transition-[box-shadow,border-color,transform]',
                listasActive
                  ? 'border-primary/50 bg-primary/10 shadow-[0_0_22px_-4px_hsl(var(--primary)/0.65)]'
                  : 'border-transparent'
              )}
            >
              <ListOrdered
                className={cn('h-5 w-5', listasActive && 'scale-110 drop-shadow-[0_0_8px_hsl(var(--primary)/0.9)]')}
                strokeWidth={2}
              />
            </span>
            <span className={cn('text-[10px] font-medium', listasActive && 'font-bold text-primary')}>
              {pathname === '/shopping-list' ? 'Lista' : 'Listas'}
            </span>
          </Link>
          <Link
            href="/dashboard"
            className={cn(
              'flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors',
              pathname === '/dashboard' ? 'text-primary' : tabInactive
            )}
          >
            <BarChart3
              className={cn('h-5 w-5', pathname === '/dashboard' && 'scale-110')}
              strokeWidth={2}
            />
            <span className={cn('text-[10px] font-medium', pathname === '/dashboard' && 'font-bold text-primary')}>
              Análise
            </span>
          </Link>
        </div>

        <div className="w-[4.25rem] shrink-0" aria-hidden />

        <div className="flex flex-1 items-end justify-end gap-0.5 pr-0.5">
          <Link
            href={mapLink}
            className={cn(
              'flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors',
              mapTabActive ? 'text-primary' : tabInactive
            )}
          >
            <Map className={cn('h-5 w-5', mapTabActive && 'scale-110')} strokeWidth={2} />
            <span className={cn('text-[10px] font-medium', mapTabActive && 'font-bold text-primary')}>
              Mapa
            </span>
          </Link>
          <Link
            href="/settings"
            className={cn(
              'flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors',
              pathname === '/settings' ? 'text-primary' : tabInactive
            )}
          >
            <User className={cn('h-5 w-5', pathname === '/settings' && 'scale-110')} strokeWidth={2} />
            <span className={cn('text-[10px] font-medium', pathname === '/settings' && 'font-bold text-primary')}>
              Perfil
            </span>
          </Link>
        </div>

        <Link
          href={mapLink}
          className={cn(
            'absolute bottom-[1rem] left-1/2 flex h-[3.5rem] w-[3.5rem] -translate-x-1/2 items-center justify-center rounded-full',
            'gradient-primary text-primary-foreground shadow-[0_8px_32px_hsl(var(--primary)/0.55)]',
            'ring-[5px] ring-background hover:brightness-110 active:scale-[0.97]',
            'border border-primary/30 transition-transform'
          )}
          aria-label="Ir para o mapa de preços"
        >
          <Navigation className="h-7 w-7" strokeWidth={2.25} />
        </Link>
      </div>
    </nav>
  );
}

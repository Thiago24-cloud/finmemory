'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { ListOrdered, BarChart3, Map, User, Navigation } from 'lucide-react';
import { cn } from '../../lib/utils';
import { canUseRestrictedFeatures } from '../../lib/restrictedFeatureAccess';
import { useSession } from 'next-auth/react';

const NEON = 'from-[#27C86A] via-[#1ed760] to-[#12b34a]';

/**
 * Barra inferior estilo mock Web3.0 — só na página de lista de compras
 * (não substitui o BottomNav global nas outras rotas).
 */
export function ShoppingListBottomNav({ mapHref = '/mapa' }) {
  const router = useRouter();
  const pathname = router.pathname;
  const { data: session } = useSession();
  const restricted = !canUseRestrictedFeatures(session?.user?.email);
  const mapLink = restricted ? '/em-breve' : mapHref;
  const listasActive = pathname === '/listas' || pathname === '/shopping-list';

  const tab = (active, children) =>
    cn(
      'relative flex flex-col items-center gap-0.5 py-1.5 min-w-[52px] rounded-xl transition-colors',
      active ? 'text-[#27C86A]' : 'text-zinc-500 hover:text-zinc-300'
    );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#0a0e14]/95 backdrop-blur-2xl safe-area-bottom">
      <div className="max-w-md mx-auto relative flex items-end justify-between h-[4.35rem] px-1 pb-1">
        <div className="flex flex-1 justify-start items-end gap-0.5 pl-0.5">
          <Link href="/listas" className={tab(listasActive)}>
            <ListOrdered className={cn('h-5 w-5', listasActive && 'scale-110')} strokeWidth={2} />
            <span className={cn('text-[10px] font-medium', listasActive && 'font-bold text-[#27C86A]')}>
              Listas
            </span>
          </Link>
          <Link href="/dashboard" className={tab(pathname === '/dashboard')}>
            <BarChart3 className={cn('h-5 w-5', pathname === '/dashboard' && 'scale-110')} strokeWidth={2} />
            <span className={cn('text-[10px] font-medium', pathname === '/dashboard' && 'font-bold text-[#27C86A]')}>
              Análise
            </span>
          </Link>
        </div>

        <div className="w-[4.25rem] shrink-0" aria-hidden />

        <div className="flex flex-1 justify-end items-end gap-0.5 pr-0.5">
          <Link href={mapLink} className={tab(pathname === '/mapa')}>
            <Map className={cn('h-5 w-5', pathname === '/mapa' && 'scale-110')} strokeWidth={2} />
            <span className={cn('text-[10px] font-medium', pathname === '/mapa' && 'font-bold text-[#27C86A]')}>
              Mapa
            </span>
          </Link>
          <Link href="/settings" className={tab(pathname === '/settings')}>
            <User className={cn('h-5 w-5', pathname === '/settings' && 'scale-110')} strokeWidth={2} />
            <span className={cn('text-[10px] font-medium', pathname === '/settings' && 'font-bold text-[#27C86A]')}>
              Perfil
            </span>
          </Link>
        </div>

        <Link
          href={mapLink}
          className={cn(
            'absolute left-1/2 -translate-x-1/2 bottom-[1rem] flex h-[3.5rem] w-[3.5rem] items-center justify-center rounded-full',
            'bg-gradient-to-br text-[#0a0e14] shadow-[0_8px_28px_rgba(39,200,106,0.45)] ring-4 ring-[#0a0e14]',
            'border border-[#27C86A]/40 hover:brightness-110 active:scale-[0.97] transition-transform',
            NEON
          )}
          aria-label="Ir para o mapa de preços"
        >
          <Navigation className="h-7 w-7" strokeWidth={2.25} />
        </Link>
      </div>
    </nav>
  );
}

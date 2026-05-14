'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Map,
  ScanLine,
  History,
  Swords,
  Sparkles,
  ScanBarcode,
  List,
  BarChart3,
  Users,
  Tags,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { DASHBOARD, QUICK_ACTION_TITLE } from '../../lib/appMicrocopy';
import { canUseRestrictedFeatures } from '../../lib/restrictedFeatureAccess';

const CELL =
  'flex flex-col items-center gap-1 w-full min-w-0 rounded-xl py-1.5 px-0.5 transition-transform hover:-translate-y-0.5 active:scale-[0.98]';

function IconTile({ className, children }) {
  return (
    <div
      className={cn(
        'w-11 h-11 sm:w-[3rem] sm:h-[3rem] rounded-2xl flex items-center justify-center border shadow-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Grelha 4×2 — FAB central continua NF-e; aqui "Escanear" + atalhos incl. código de barras (consulta rápida).
 * Mapa / código / lista / parceria respeitam a mesma allowlist que QuickActions e BottomNav.
 */
export function DashboardQuickAccess({ className, onExtrato }) {
  const { data: session } = useSession();
  const allowed = canUseRestrictedFeatures(session?.user?.email);

  const LOCKED = ['/mapa', '/scan-product', '/shopping-list', '/partnership'];
  const hrefOrLock = (path, realHref) =>
    allowed || !LOCKED.includes(path) ? realHref : '/em-breve';

  const items = [
    {
      key: 'mapa',
      href: hrefOrLock('/mapa', '/mapa'),
      label: 'Mapa',
      Icon: Map,
      tile: 'bg-gradient-to-br from-sky-900/70 to-[#1E2A3A] border-sky-500/35 text-sky-300',
      labelClass: 'text-sky-200/95',
    },
    {
      key: 'scan',
      href: '/add-receipt',
      label: 'Escanear',
      Icon: ScanLine,
      tile: 'bg-gradient-to-br from-emerald-950/90 to-[#1E2A3A] border-emerald-500/40 text-emerald-300',
      labelClass: 'text-emerald-300',
      title: 'Escanear nota fiscal (NF-e)',
    },
    {
      key: 'extrato',
      label: 'Extrato',
      Icon: History,
      tile: 'bg-gradient-to-br from-violet-950/80 to-[#1E2A3A] border-violet-500/30 text-violet-300',
      labelClass: 'text-violet-200/95',
      onClick: onExtrato,
      title: 'Ver histórico de gastos',
    },
    {
      key: 'missoes',
      href: '/missoes',
      label: 'Missões',
      Icon: Swords,
      tile: 'bg-gradient-to-br from-amber-950/70 to-[#1E2A3A] border-amber-500/35 text-amber-300',
      labelClass: 'text-amber-200/95',
    },
    {
      key: 'simulador',
      href: '/simulador',
      label: 'Simulador',
      Icon: Sparkles,
      tile: 'bg-gradient-to-br from-purple-950/80 to-[#1E2A3A] border-purple-500/30 text-purple-300',
      labelClass: 'text-purple-200/95',
      title: QUICK_ACTION_TITLE.simulador,
    },
    {
      key: 'lista',
      href: hrefOrLock('/shopping-list', '/shopping-list'),
      label: 'Lista',
      Icon: List,
      tile: 'bg-gradient-to-br from-emerald-950/60 to-[#1E2A3A] border-emerald-500/25 text-emerald-300',
      labelClass: 'text-emerald-300/95',
    },
    {
      key: 'relatorios',
      href: '/reports',
      label: 'Relatórios',
      Icon: BarChart3,
      tile: 'bg-gradient-to-br from-indigo-950/80 to-[#1E2A3A] border-indigo-500/30 text-indigo-300',
      labelClass: 'text-indigo-200/95',
    },
    {
      key: 'barcode',
      href: hrefOrLock('/scan-product', '/scan-product'),
      label: 'Código de barras',
      Icon: ScanBarcode,
      tile: 'bg-gradient-to-br from-red-950/70 to-[#1E2A3A] border-red-500/40 text-red-300',
      labelClass: 'text-red-300',
      title: QUICK_ACTION_TITLE.barcode,
    },
  ];

  return (
    <section className={cn('px-5', className)} aria-label="Acesso rápido">
      <p className="text-[13px] font-semibold tracking-tight text-foreground mb-2.5">
        {DASHBOARD.quickSectionTitle}
      </p>
      <div className="grid grid-cols-4 gap-x-1.5 gap-y-3">
        {items.map(({ key, href, label, Icon, tile, labelClass, onClick, title }) => {
          const body = (
            <>
              <IconTile className={tile}>
                <Icon className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5 shrink-0" strokeWidth={2} />
              </IconTile>
              <span
                className={cn(
                  'text-[10px] sm:text-[11px] font-semibold text-center leading-[1.15] px-0.5 line-clamp-2',
                  labelClass
                )}
              >
                {label}
              </span>
            </>
          );

          if (onClick) {
            return (
              <button
                key={key}
                type="button"
                className={cn(CELL, 'text-inherit bg-transparent border-0 cursor-pointer')}
                onClick={onClick}
                title={title}
              >
                {body}
              </button>
            );
          }

          return (
            <Link
              key={key}
              href={href}
              className={cn(CELL, 'no-underline text-inherit')}
              title={title || label}
            >
              {body}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px]">
        <Link
          href={hrefOrLock('/partnership', '/partnership')}
          className="font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 opacity-80" aria-hidden />
            Parceria
          </span>
        </Link>
        <Link
          href="/categories"
          className="font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <span className="inline-flex items-center gap-1">
            <Tags className="h-3.5 w-3.5 opacity-80" aria-hidden />
            Categorias
          </span>
        </Link>
      </div>
    </section>
  );
}

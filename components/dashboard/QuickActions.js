import Link from 'next/link';
import { BarChart3, Tags, Users, List, ScanBarcode, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

const SECONDARY_ACTIONS = [
  {
    href: '/simulador',
    label: 'Simulador',
    title: 'Simular saldo, rede de apoio e crédito',
    Icon: Sparkles,
    wrapClass:
      'bg-gradient-to-br from-purple-950 to-zinc-900 text-purple-200 border border-purple-500/35 hover:from-purple-900 hover:to-zinc-900',
    labelClass: 'text-purple-100',
  },
  {
    href: '/scan-product',
    label: 'Código de barras',
    title: 'Ler código de barras',
    wide: true,
    Icon: ScanBarcode,
    wrapClass:
      'bg-red-50 text-red-600 border-2 border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15)] hover:bg-red-100',
    labelClass: 'text-red-700',
  },
  {
    href: '/partnership',
    label: 'Parceria',
    Icon: Users,
    wrapClass: 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100',
    labelClass: 'text-rose-800',
  },
  {
    href: '/shopping-list',
    label: 'Lista',
    Icon: List,
    wrapClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100',
    labelClass: 'text-emerald-800',
  },
  {
    href: '/reports',
    label: 'Relatórios',
    Icon: BarChart3,
    wrapClass: 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100',
    labelClass: 'text-indigo-800',
  },
  {
    href: '/categories',
    label: 'Categorias',
    Icon: Tags,
    wrapClass: 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-200 hover:bg-fuchsia-100',
    labelClass: 'text-fuchsia-800',
  },
];

/**
 * Ações rápidas — grelha (escanear nota no card principal e na barra inferior).
 */
export function QuickActions({ className }) {
  const secondaryBtn =
    'flex flex-col items-center gap-2 w-full max-w-[92px] mx-auto hover:-translate-y-0.5 transition-transform duration-200';
  const secondaryBtnWide =
    'flex flex-col items-center gap-2 w-full max-w-[118px] mx-auto hover:-translate-y-0.5 transition-transform duration-200';

  return (
    <div className={cn('max-w-lg mx-auto px-1', className)}>
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5 justify-items-stretch max-w-[280px] sm:max-w-[380px] mx-auto"
        role="navigation"
        aria-label="Mais ações"
      >
        {SECONDARY_ACTIONS.map(({ href, label, title, Icon, wrapClass, labelClass, wide }) => (
          <Link
            key={href}
            href={href}
            className={cn(wide ? secondaryBtnWide : secondaryBtn, 'no-underline text-inherit')}
            title={title}
          >
            <div
              className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-sm',
                wrapClass
              )}
            >
              <Icon className="h-6 w-6 shrink-0" strokeWidth={2} />
            </div>
            <span className={cn('text-[11px] sm:text-xs font-semibold text-center leading-tight', labelClass)}>
              {label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

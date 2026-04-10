import Link from 'next/link';
import {
  BarChart3,
  Tags,
  MapPin,
  Share2,
  PenLine,
  Users,
  List,
  CreditCard,
  ScanBarcode,
} from 'lucide-react';
import { cn } from '../../lib/utils';

/** Ícone estilo nota fiscal / cupom (SVG inline — evita asset externo). */
function NotaFiscalIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M7 3h10a2 2 0 012 2v14l-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path d="M9 7h6M9 10h6M9 13h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path
        d="M8 16h8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="1.5 2"
      />
    </svg>
  );
}

const SECONDARY_ACTIONS = [
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
    href: '/share-price',
    label: 'Preço',
    Icon: Share2,
    wrapClass: 'bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100',
    labelClass: 'text-sky-800',
  },
  {
    href: '/cartoes',
    label: 'Cartões',
    title: 'Cartões (manual)',
    Icon: CreditCard,
    wrapClass: 'bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100',
    labelClass: 'text-violet-800',
  },
  {
    href: '/manual-entry',
    label: 'Gasto',
    Icon: PenLine,
    wrapClass: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
    labelClass: 'text-amber-900',
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
 * Ações rápidas – destaque Escanear + Mapa; demais em grelha 4×2.
 */
export function QuickActions({ className }) {
  const primaryBtn =
    'flex flex-col items-center gap-2 min-w-[88px] hover:-translate-y-0.5 transition-transform duration-200';
  const secondaryBtn =
    'flex flex-col items-center gap-2 w-full max-w-[92px] mx-auto hover:-translate-y-0.5 transition-transform duration-200';
  const secondaryBtnWide =
    'flex flex-col items-center gap-2 w-full max-w-[118px] mx-auto hover:-translate-y-0.5 transition-transform duration-200';

  return (
    <div className={cn('max-w-lg mx-auto px-1', className)}>
      <div className="flex flex-wrap gap-6 mb-6 justify-center px-1">
        <Link
          href="/add-receipt"
          className={cn(primaryBtn, 'no-underline text-inherit')}
          title="Foto da nota ou QR Code NFC-e"
        >
          <div className="w-[4.5rem] h-[4.5rem] rounded-2xl flex items-center justify-center shadow-md bg-gradient-to-br from-[#e8f5e9] to-[#c8e6c9] text-[#2e7d32] ring-1 ring-black/5 hover:from-[#c8e6c9] hover:to-[#a5d6a7] transition-colors">
            <NotaFiscalIcon className="h-9 w-9" />
          </div>
          <span className="text-xs font-semibold text-neutral-800 whitespace-nowrap">Escanear</span>
        </Link>
        <Link href="/mapa" className={cn(primaryBtn, 'no-underline text-inherit')}>
          <div className="w-[4.5rem] h-[4.5rem] rounded-2xl flex items-center justify-center shadow-md bg-gradient-to-br from-[#e3f2fd] to-[#bbdefb] text-[#0d47a1] ring-1 ring-black/5 hover:from-[#bbdefb] hover:to-[#90caf9] transition-colors">
            <MapPin className="h-8 w-8" />
          </div>
          <span className="text-xs font-semibold text-neutral-800 whitespace-nowrap">Mapa</span>
        </Link>
      </div>

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

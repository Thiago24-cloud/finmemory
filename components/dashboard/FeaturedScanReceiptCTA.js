'use client';

import Link from 'next/link';
import { cn } from '../../lib/utils';

function NotaFiscalHeroIcon({ className }) {
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
        fillOpacity="0.12"
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

/**
 * CTA principal: escanear nota fiscal (destaque no dashboard).
 */
export function FeaturedScanReceiptCTA({ className }) {
  return (
    <Link
      href="/add-receipt"
      className={cn(
        'group block no-underline rounded-3xl mb-5 relative overflow-hidden',
        'border-2 border-[#2ECC49]/80',
        'shadow-[0_0_0_4px_rgba(46,204,73,0.12),0_16px_40px_rgba(46,204,73,0.18)]',
        'bg-gradient-to-br from-white via-[#f0fdf4] to-[#dcfce7]',
        'active:scale-[0.99] transition-transform duration-200',
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-60 animate-pulse"
        style={{
          boxShadow: 'inset 0 0 40px rgba(46,204,73,0.15)',
        }}
      />
      <div className="relative flex items-center gap-4 p-4 sm:p-5">
        <div
          className="shrink-0 w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-2xl flex items-center justify-center text-[#166534] bg-white shadow-md ring-2 ring-[#2ECC49]/30 group-hover:ring-[#2ECC49]/50 transition-shadow"
          aria-hidden
        >
          <NotaFiscalHeroIcon className="h-10 w-10 sm:h-11 sm:w-11" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs font-bold tracking-wide text-[#15803d] uppercase m-0 mb-1">
            Escanear nota fiscal
          </p>
          <h2 className="text-base sm:text-lg font-bold text-[#14532d] m-0 leading-snug">
            Tire foto e automatize produtos e preços na hora
          </h2>
        </div>
      </div>
    </Link>
  );
}

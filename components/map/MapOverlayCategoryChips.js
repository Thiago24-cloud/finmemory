'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  ShoppingBag,
  Apple,
  Wheat,
  Wine,
  Snowflake,
  Sparkles,
  Droplets,
  Heart,
  ScanBarcode,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { MAP_CHIPS } from '../../lib/appMicrocopy';

/**
 * Chips estilo Google Maps: à direita da pesquisa, com setas para rolar conteúdo oculto.
 */
const FILTER_CHIPS = [
  { id: 'todos', label: MAP_CHIPS.todos, Icon: LayoutGrid, promoOnly: false, search: '' },
  { id: 'dia', label: MAP_CHIPS.dia, Icon: ShoppingBag, promoOnly: true, search: 'dia' },
  { id: 'hortifruti', label: MAP_CHIPS.hortifruti, Icon: Apple, promoOnly: false, search: 'hortifruti' },
  { id: 'mercearia', label: MAP_CHIPS.mercearia, Icon: Wheat, promoOnly: false, search: 'mercearia' },
  { id: 'bebidas', label: MAP_CHIPS.bebidas, Icon: Wine, promoOnly: false, search: 'bebida' },
  {
    id: 'congelados',
    label: MAP_CHIPS.congelados,
    Icon: Snowflake,
    promoOnly: false,
    search: 'congelado',
  },
  {
    id: 'cuidados',
    label: MAP_CHIPS.cuidados,
    Icon: Sparkles,
    promoOnly: false,
    search: 'higiene',
  },
  { id: 'limpeza', label: MAP_CHIPS.limpeza, Icon: Droplets, promoOnly: false, search: 'limpeza' },
];

const LINK_CHIPS = [
  { id: 'barcode', label: MAP_CHIPS.barcode, Icon: ScanBarcode, href: '/scan-product' },
  { id: 'favoritos', label: MAP_CHIPS.favoritos, Icon: Heart, href: '/shopping-list' },
];

const SCROLL_STEP = 200;

function useScrollEdges(scrollerRef) {
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);

  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setLeft(scrollLeft > 2);
    setRight(max > 2 && scrollLeft < max - 2);
  }, [scrollerRef]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [update, scrollerRef]);

  return { canScrollLeft: left, canScrollRight: right, updateEdges: update };
}

export function MapOverlayCategoryChips({
  mapsMobileLayout = false,
  promoOnly,
  setPromoOnly,
  searchQuery,
  setSearchQuery,
  mapChipSelection,
  setMapChipSelection,
}) {
  const scrollerRef = useRef(null);
  const { canScrollLeft, canScrollRight, updateEdges } = useScrollEdges(scrollerRef);

  /** Sempre estilo Google Maps: fundo branco, texto escuro (tema global .dark não escurece o mapa). */
  const mapsPill =
    'bg-white text-[#202124] shadow-[0_1px_3px_rgba(0,0,0,0.12),_0_1px_2px_rgba(0,0,0,0.24)] border border-[#dadce0] hover:bg-[#f8f9fa] active:scale-[0.97]';

  const mapsPillActive =
    'bg-[#e8f0fe] border-[#1a73e8] text-[#174ea6] shadow-[0_1px_3px_rgba(0,0,0,0.12),_0_1px_2px_rgba(0,0,0,0.24)] [&_svg]:text-[#1a73e8]';

  const arrowBtn =
    'bg-white text-[#5f6368] shadow-[0_1px_3px_rgba(0,0,0,0.12),_0_1px_2px_rgba(0,0,0,0.24)] border border-[#dadce0] hover:bg-[#f8f9fa]';

  const applyFilterChip = (chip) => {
    setMapChipSelection(chip.id);
    setPromoOnly(chip.promoOnly);
    setSearchQuery(chip.search);
  };

  const isFilterActive = (chip) =>
    mapChipSelection === chip.id &&
    promoOnly === chip.promoOnly &&
    searchQuery.trim().toLowerCase() === String(chip.search).toLowerCase();

  const scrollByDir = (delta) => {
    const el = scrollerRef.current;
    if (el) {
      el.scrollBy({ left: delta, behavior: 'smooth' });
      window.setTimeout(updateEdges, 350);
    }
  };

  const fadeFrom = mapsMobileLayout ? 'from-white' : 'from-[#e8e4de]/95';

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-0.5 sm:gap-1 pointer-events-auto',
        mapsMobileLayout ? 'w-full' : 'flex-1'
      )}
      role="navigation"
      aria-label="Categorias e atalhos no mapa"
    >
      <button
        type="button"
        aria-label="Ver opções anteriores"
        aria-disabled={!canScrollLeft}
        disabled={!canScrollLeft}
        onClick={() => scrollByDir(-SCROLL_STEP)}
        className={cn(
          'z-[2] flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity',
          mapsMobileLayout && 'hidden md:flex',
          arrowBtn,
          !canScrollLeft && 'pointer-events-none opacity-35'
        )}
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2} />
      </button>

      <div className="relative min-w-0 flex-1">
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 z-[1] w-5 bg-gradient-to-r to-transparent',
            fadeFrom
          )}
          aria-hidden
        />
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 z-[1] w-5 bg-gradient-to-l to-transparent',
            fadeFrom
          )}
          aria-hidden
        />

        <div
          ref={scrollerRef}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide scroll-smooth py-0.5 pl-1 pr-1"
          role="tablist"
        >
          {FILTER_CHIPS.map((chip) => {
            const active = isFilterActive(chip);
            const Icon = chip.Icon;
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => applyFilterChip(chip)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full py-2 pl-3 pr-3.5 text-[12px] sm:text-[13px] font-medium transition-all duration-150',
                  mapsPill,
                  active && mapsPillActive
                )}
              >
                <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                <span className="whitespace-nowrap">{chip.label}</span>
              </button>
            );
          })}
          {LINK_CHIPS.map((chip) => {
            const Icon = chip.Icon;
            return (
              <Link
                key={chip.id}
                href={chip.href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full py-2 pl-3 pr-3.5 text-[12px] sm:text-[13px] font-medium transition-all duration-150 no-underline',
                  mapsPill
                )}
              >
                <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                <span className="whitespace-nowrap">{chip.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        aria-label="Ver mais opções"
        aria-disabled={!canScrollRight}
        disabled={!canScrollRight}
        onClick={() => scrollByDir(SCROLL_STEP)}
        className={cn(
          'z-[2] flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity',
          mapsMobileLayout && 'hidden md:flex',
          arrowBtn,
          !canScrollRight && 'pointer-events-none opacity-35'
        )}
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2} />
      </button>
    </div>
  );
}

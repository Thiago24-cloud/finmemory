'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Sacola flutuante — recebe itens da jornada Caça-Preço.
 */
export function CacaPrecoWishBag({ items = [], className }) {
  const count = items.length;
  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[58] flex flex-col items-end gap-1',
        'right-3 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))]',
        className
      )}
    >
      <div className="pointer-events-auto relative rounded-2xl border-2 border-[#C9A227]/80 bg-[#1C1C1E]/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2 text-white">
          <ShoppingBag className="h-5 w-5 text-[#C9A227]" aria-hidden />
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-300">Sacola</span>
          <span className="rounded-full bg-[#C9A227] px-2 py-0.5 text-xs font-black text-black">
            {count}
          </span>
        </div>
        <AnimatePresence initial={false}>
          {count > 0 ? (
            <motion.ul
              key="bag-list"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 max-h-28 overflow-y-auto space-y-1 border-t border-white/10 pt-2"
            >
              {items.slice(-4).map((item) => (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[11px] text-zinc-200 truncate max-w-[200px]"
                >
                  {item.productName || item.name}
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

'use client';

import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { OnboardingHandPointer } from './OnboardingHandPointer';

function formatPrice(item) {
  const n = Number(item?.priceNum ?? item?.price);
  if (!Number.isFinite(n) || n <= 0) return item?.precoLabel || '—';
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

/**
 * Lista de produtos do dia + mãozinha no primeiro item.
 */
export function CacaPrecoProductPicker({
  products = [],
  selectedIds = new Set(),
  onToggleProduct,
  onFinishList,
  minItemsToFinish = 1,
  className,
}) {
  const firstRef = useRef(null);
  const [handHole, setHandHole] = useState(null);

  useEffect(() => {
    const el = firstRef.current;
    if (!el || products.length === 0) {
      setHandHole(null);
      return undefined;
    }
    const update = () => {
      const r = el.getBoundingClientRect();
      setHandHole({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        bottom: r.bottom,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const t = window.setTimeout(update, 120);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.clearTimeout(t);
    };
  }, [products.length]);

  const selectedCount = selectedIds.size;
  const canFinish = selectedCount >= minItemsToFinish;

  return (
    <>
      {handHole && products.length > 0 ? (
        <OnboardingHandPointer hole={handHole} placement="right" />
      ) : null}
      <div
        className={cn(
          'pointer-events-none fixed left-3 right-3 z-[57] mx-auto max-w-md',
          'bottom-[calc(10.5rem+env(safe-area-inset-bottom,0px))]',
          className
        )}
      >
        <div className="pointer-events-auto max-h-[42vh] overflow-hidden rounded-2xl border border-white/15 bg-[#111827]/96 shadow-2xl backdrop-blur-md">
          <p className="px-3 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            Produtos do dia
          </p>
          <ul className="overflow-y-auto px-2 pb-2 max-h-[34vh]">
            {products.map((p, idx) => {
              const id = String(p.id);
              const selected = selectedIds.has(id);
              return (
                <li key={id} ref={idx === 0 ? firstRef : undefined}>
                  <button
                    type="button"
                    onClick={() => onToggleProduct?.(p)}
                    className={cn(
                      'mt-1.5 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'border-emerald-400/60 bg-emerald-500/15'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg',
                        selected ? 'bg-emerald-500 text-[#052e16]' : 'bg-white/10'
                      )}
                      aria-hidden
                    >
                      {selected ? '✓' : '🛒'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {p.productName || p.name || p.produto}
                      </span>
                      <span className="text-xs text-emerald-300">{formatPrice(p)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {canFinish ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-white/10 px-3 py-2.5"
            >
              <button
                type="button"
                onClick={onFinishList}
                className="w-full rounded-xl bg-[#C9A227] py-2.5 text-sm font-extrabold text-black hover:bg-[#d4ad2f]"
              >
                Terminar lista ({selectedCount})
              </button>
            </motion.div>
          ) : (
            <p className="px-3 pb-2 text-[11px] text-zinc-400">
              Toque nos produtos para adicionar à sacola ({selectedCount}/{minItemsToFinish})
            </p>
          )}
        </div>
      </div>
    </>
  );
}

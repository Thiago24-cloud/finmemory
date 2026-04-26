'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';

export default function FloatingCartBar({ itemsCount = 0, onOpenList, className = '' }) {
  const prevCountRef = useRef(itemsCount);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (itemsCount > prevCountRef.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 260);
      prevCountRef.current = itemsCount;
      return () => window.clearTimeout(t);
    }
    prevCountRef.current = itemsCount;
    return undefined;
  }, [itemsCount]);

  if (itemsCount <= 0) return null;

  return (
    <div className={`fixed inset-x-0 bottom-[5.25rem] z-[1101] px-3 ${className}`.trim()}>
      <div className="mx-auto flex w-full max-w-md items-center justify-between rounded-2xl border border-emerald-400/40 bg-[#0f1117]/95 px-4 py-3 text-white shadow-[0_10px_28px_rgba(16,185,129,0.35)] backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className={`rounded-full bg-emerald-500/20 p-2 ${pulse ? 'scale-110 opacity-90' : 'scale-100 opacity-100'} transition-all duration-200`}>
            <ShoppingCart className="h-4 w-4 text-emerald-300" />
          </div>
          <p className="text-sm font-semibold">{itemsCount} item(ns) no carrinho</p>
        </div>
        <Link
          href="/shopping-list"
          onClick={onOpenList}
          className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-[#0f1117] no-underline hover:bg-emerald-400"
        >
          Ver lista
        </Link>
      </div>
    </div>
  );
}

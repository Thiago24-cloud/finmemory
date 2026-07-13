'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

export const SkipPriceMap = dynamic(
  () => import('./SkipPriceMapClient').then((m) => m.SkipPriceMap),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 w-full h-full bg-[#0d1b2e] flex items-center justify-center z-0">
        <Loader2 className="w-8 h-8 animate-spin text-[#39FF14]" aria-label="Carregando mapa" />
      </div>
    ),
  }
);

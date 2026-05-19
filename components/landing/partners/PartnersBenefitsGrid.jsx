'use client';

import { CreditCard, LayoutDashboard, MapPinned, Package } from 'lucide-react';
import { PARTNERS_BENEFITS } from '../../../lib/partners/landingCopy';

const ICONS = {
  panel: LayoutDashboard,
  geo: MapPinned,
  pay: CreditCard,
  pickup: Package,
};

export function PartnersBenefitsGrid() {
  return (
    <section id="beneficios" className="px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#39FF14] mb-3">Multitenancy</p>
        <h2 className="text-2xl sm:text-3xl font-bold m-0 max-w-2xl">
          Sua loja isolada. Seu estoque. Suas ofertas.
        </h2>
        <p className="mt-3 text-white/60 max-w-2xl m-0">
          Inspirado no modelo de parceiros do iFood, com foco em varejo regional e retirada no balcão — sem
          competir com o cardápio do vizinho.
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-4 lg:gap-6">
          {PARTNERS_BENEFITS.map((item) => {
            const Icon = ICONS[item.icon] || LayoutDashboard;
            return (
              <article
                key={item.title}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-[#39FF14]/40 hover:bg-white/[0.05] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-[#39FF14]/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Icon className="h-6 w-6 text-[#39FF14]" aria-hidden />
                </div>
                <h3 className="text-lg font-bold m-0">{item.title}</h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed m-0">{item.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

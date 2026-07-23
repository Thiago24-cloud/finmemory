'use client';

import {
  LayoutDashboard,
  MapPinned,
  PackageCheck,
  Receipt,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
import { PARTNERS_BENEFITS, PARTNERS_OFFERS_SECTION } from '../../../lib/partners/landingCopy';

const ICONS = {
  panel: LayoutDashboard,
  map: MapPinned,
  stock: PackageCheck,
  sales: Receipt,
  profit: TrendingUp,
  insights: Lightbulb,
};

export function PartnersBenefitsGrid() {
  return (
    <section id="servicos" className="px-4 sm:px-6 py-14 sm:py-20 scroll-mt-20 bg-white border-y border-[#dbe7df]">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#0b1f3a] m-0 text-center">
          {PARTNERS_OFFERS_SECTION.title}
        </h2>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {PARTNERS_BENEFITS.map((item) => {
            const Icon = ICONS[item.icon] || LayoutDashboard;
            return (
              <article
                key={item.title}
                className="rounded-2xl border border-[#dbe7df] bg-[#f7fbf8] p-6 hover:border-[#86efac] hover:shadow-[0_12px_32px_rgba(11,31,58,0.06)] transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-[#dcfce7] flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-[#16a34a]" aria-hidden />
                </div>
                <h3 className="text-lg font-bold text-[#0b1f3a] m-0">{item.title}</h3>
                <p className="mt-2 text-sm text-[#475569] leading-relaxed m-0">{item.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

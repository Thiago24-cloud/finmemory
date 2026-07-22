'use client';

import { Check } from 'lucide-react';
import { PARTNERS_PLANS, PARTNERS_PLANS_SECTION } from '../../../lib/partners/landingCopy';

export function PartnersPlansSection() {
  return (
    <section id="pacotes" className="px-4 sm:px-6 py-14 sm:py-20 scroll-mt-20 bg-white border-y border-[#dbe7df]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0b1f3a] m-0">
            {PARTNERS_PLANS_SECTION.title}
          </h2>
          <p className="mt-3 text-[#475569] m-0">{PARTNERS_PLANS_SECTION.subtitle}</p>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
          {PARTNERS_PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-5 sm:p-6 ${
                plan.highlighted
                  ? 'border-[#16a34a] bg-[#f0fdf4] shadow-[0_16px_40px_rgba(22,163,74,0.12)] ring-1 ring-[#16a34a]/20'
                  : 'border-[#dbe7df] bg-[#f7fbf8]'
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#16a34a] m-0">
                {plan.audience}
              </p>
              <h3 className="text-lg font-bold text-[#0b1f3a] m-0 mt-2">{plan.name}</h3>
              <p className="text-sm text-[#475569] m-0 mt-2 leading-snug">{plan.tagline}</p>

              <div className="mt-5 mb-5">
                <p className="m-0">
                  <span className="text-2xl font-bold text-[#0b1f3a]">{plan.price}</span>
                  <span className="text-sm text-[#64748b]">{plan.priceNote}</span>
                </p>
              </div>

              <ul className="space-y-2.5 list-none p-0 m-0 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm text-[#0b1f3a]">
                    <Check className="h-4 w-4 text-[#16a34a] shrink-0 mt-0.5" aria-hidden />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#cadastro"
                className={`mt-6 inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] ${
                  plan.highlighted
                    ? 'bg-[#16a34a] text-white shadow-[0_8px_24px_rgba(22,163,74,0.28)] hover:bg-[#15803d]'
                    : 'border border-[#cbd5e1] bg-white text-[#0b1f3a] hover:bg-[#f8fafc]'
                }`}
              >
                Quero testar
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

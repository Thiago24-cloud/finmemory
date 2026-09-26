'use client';

import { PARTNERS_CLOSING } from '../../../lib/partners/landingCopy';

export function PartnersClosingSection() {
  return (
    <section className="px-4 sm:px-6 py-14 sm:py-20">
      <div className="max-w-3xl mx-auto text-center rounded-[2rem] border border-[#bbf7d0] bg-gradient-to-b from-[#f0fdf4] to-white px-6 sm:px-10 py-12 sm:py-14 shadow-[0_16px_40px_rgba(22,163,74,0.08)]">
        <h2 className="text-2xl sm:text-4xl font-bold text-[#0b1f3a] m-0 tracking-tight">
          {PARTNERS_CLOSING.title}
        </h2>
        <div className="mt-5 space-y-3">
          {PARTNERS_CLOSING.body.map((para) => (
            <p key={para} className="text-base text-[#475569] leading-relaxed m-0">
              {para}
            </p>
          ))}
        </div>
        <div className="mt-6 space-y-1">
          {PARTNERS_CLOSING.lines.map((line) => (
            <p key={line} className="text-sm sm:text-base font-semibold text-[#0b1f3a] m-0">
              {line}
            </p>
          ))}
        </div>
        <a
          href="#cadastro"
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#16a34a] px-8 py-3.5 text-sm sm:text-base font-bold text-white shadow-[0_12px_32px_rgba(22,163,74,0.32)] hover:bg-[#15803d] transition-all active:scale-[0.98]"
        >
          {PARTNERS_CLOSING.cta}
        </a>
      </div>
    </section>
  );
}

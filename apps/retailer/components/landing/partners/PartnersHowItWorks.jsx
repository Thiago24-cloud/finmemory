'use client';

import { PARTNERS_STEPS } from '../../../lib/partners/landingCopy';

export function PartnersHowItWorks() {
  return (
    <section id="como-funciona" className="px-4 sm:px-6 py-14 sm:py-20 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#0b1f3a] m-0 text-center">Como funciona</h2>
        <ol className="mt-12 grid sm:grid-cols-3 gap-6 list-none p-0 m-0">
          {PARTNERS_STEPS.map((s) => (
            <li key={s.step} className="relative text-center sm:text-left">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#16a34a] text-white text-xl font-bold">
                {s.step}
              </span>
              <h3 className="text-base font-bold text-[#0b1f3a] mt-4 m-0">{s.title}</h3>
              <p className="text-sm text-[#475569] mt-2 leading-relaxed m-0">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

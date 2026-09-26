'use client';

import { PARTNERS_PROBLEM } from '../../../lib/partners/landingCopy';

export function PartnersProblemSection() {
  return (
    <section className="px-4 sm:px-6 py-14 sm:py-16">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#0b1f3a] m-0 leading-snug">
          {PARTNERS_PROBLEM.title}
        </h2>
        <p className="mt-4 text-base text-[#475569] m-0">{PARTNERS_PROBLEM.intro}</p>
        <ul className="mt-8 grid sm:grid-cols-2 gap-3 list-none p-0 m-0 text-left">
          {PARTNERS_PROBLEM.items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 rounded-2xl border border-[#dbe7df] bg-white px-4 py-3 text-sm text-[#0b1f3a]"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#dcfce7] text-[#16a34a] text-xs font-bold"
                aria-hidden
              >
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

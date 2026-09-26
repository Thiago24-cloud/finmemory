'use client';

import { PARTNERS_AUDIENCE } from '../../../lib/partners/landingCopy';

export function PartnersAudienceSection() {
  return (
    <section className="px-4 sm:px-6 py-14 sm:py-16 bg-white border-y border-[#dbe7df]">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#0b1f3a] m-0">
          {PARTNERS_AUDIENCE.title}
        </h2>
        <ul className="mt-8 flex flex-wrap justify-center gap-2.5 list-none p-0 m-0">
          {PARTNERS_AUDIENCE.items.map((item) => (
            <li
              key={item}
              className="rounded-full border border-[#dbe7df] bg-[#f7fbf8] px-4 py-2 text-sm font-medium text-[#0b1f3a]"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

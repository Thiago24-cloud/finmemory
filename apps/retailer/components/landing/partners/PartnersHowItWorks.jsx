'use client';

import { PARTNERS_STEPS } from '../../../lib/partners/landingCopy';

export function PartnersHowItWorks() {
  return (
    <section id="como-funciona" className="px-4 sm:px-6 py-16 scroll-mt-20 bg-white/[0.02] border-y border-white/5">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold m-0 text-center">Como funciona na prática</h2>
        <p className="text-center text-white/55 mt-3 max-w-xl mx-auto m-0">
          Do cadastro à primeira venda em poucos passos — tudo pelo navegador, sem instalar nada no PC da loja.
        </p>
        <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 list-none p-0 m-0">
          {PARTNERS_STEPS.map((s) => (
            <li key={s.step} className="relative">
              <span className="text-4xl font-black text-[#39FF14]/20">{s.step}</span>
              <h3 className="text-base font-bold mt-2 m-0">{s.title}</h3>
              <p className="text-sm text-white/55 mt-2 leading-relaxed m-0">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

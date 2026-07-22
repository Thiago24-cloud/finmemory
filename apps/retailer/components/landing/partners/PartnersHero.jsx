'use client';

import { PARTNERS_HERO } from '../../../lib/partners/landingCopy';

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[280px]">
      <div
        className="absolute -inset-8 rounded-[3rem] bg-[radial-gradient(circle_at_50%_30%,rgba(22,163,74,0.18),transparent_70%)]"
        aria-hidden
      />
      <div className="relative rounded-[2rem] border-[6px] border-[#0b1f3a] bg-[#0b1f3a] shadow-[0_28px_60px_rgba(11,31,58,0.28)] overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#0b1f3a] rounded-b-2xl z-10" aria-hidden />
        <div className="bg-white rounded-[1.5rem] m-1.5 pt-7 pb-5 px-4 min-h-[460px]">
          <p className="text-sm font-bold text-[#0b1f3a] m-0">FinMemory</p>
          <p className="text-[11px] text-[#64748b] m-0 mt-0.5">Hoje</p>

          <div className="mt-4 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] p-3">
            <p className="text-[10px] uppercase tracking-wide text-[#15803d] font-semibold m-0">Vendas hoje</p>
            <p className="text-2xl font-bold text-[#0b1f3a] m-0 mt-1">R$ 320,00</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-3">
              <p className="text-[10px] text-[#64748b] m-0">Lucro</p>
              <p className="text-base font-bold text-[#16a34a] m-0 mt-1">R$ 95,00</p>
            </div>
            <div className="rounded-xl bg-[#fff7ed] border border-[#fed7aa] p-3">
              <p className="text-[10px] text-[#9a3412] m-0">Estoque baixo</p>
              <p className="text-base font-bold text-[#c2410c] m-0 mt-1">4 itens</p>
            </div>
          </div>

          <div className="mt-4 flex gap-1.5">
            {['Estoque', 'Vendas', 'Lucro'].map((tab) => (
              <span
                key={tab}
                className="flex-1 text-center text-[10px] font-semibold rounded-lg py-2 bg-[#0b1f3a] text-white"
              >
                {tab}
              </span>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {[
              { label: 'Receita', value: 'R$ 2.450' },
              { label: 'Lucro estimado', value: 'R$ 780' },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-xl border border-[#e2e8f0] px-3 py-2.5"
              >
                <span className="text-xs text-[#64748b]">{row.label}</span>
                <span className="text-sm font-bold text-[#0b1f3a]">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PartnersHero() {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden px-4 sm:px-6 py-14 sm:py-20 scroll-mt-20"
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 15% 0%, rgba(22,163,74,0.12), transparent), radial-gradient(ellipse 50% 40% at 90% 10%, rgba(11,31,58,0.06), transparent)',
        }}
      />
      <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#16a34a] mb-4 m-0">
            {PARTNERS_HERO.brand}
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold leading-[1.12] tracking-tight text-[#0b1f3a] m-0">
            {PARTNERS_HERO.title}
          </h1>
          <p className="mt-5 text-base sm:text-lg text-[#475569] leading-relaxed max-w-xl m-0">
            {PARTNERS_HERO.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#cadastro"
              className="inline-flex items-center justify-center rounded-xl bg-[#16a34a] px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-[0_12px_32px_rgba(22,163,74,0.32)] hover:bg-[#15803d] transition-all active:scale-[0.98]"
            >
              {PARTNERS_HERO.ctaPrimary}
            </a>
            <a
              href="#como-funciona"
              className="inline-flex items-center justify-center rounded-xl border border-[#cbd5e1] bg-white px-6 py-3.5 text-sm font-semibold text-[#0b1f3a] hover:bg-[#f8fafc] transition-colors"
            >
              {PARTNERS_HERO.ctaSecondary}
            </a>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}

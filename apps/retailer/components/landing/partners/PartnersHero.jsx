'use client';

import { Bell, MapPin, PackageCheck } from 'lucide-react';
import { PARTNERS_HERO } from '../../../lib/partners/landingCopy';

export function PartnersHero() {
  return (
    <section className="relative overflow-hidden px-4 sm:px-6 py-16 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(57,255,20,0.18), transparent), radial-gradient(ellipse 40% 30% at 90% 20%, rgba(99,102,241,0.12), transparent)',
        }}
      />
      <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#39FF14] mb-4">
            {PARTNERS_HERO.eyebrow}
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight m-0">
            {PARTNERS_HERO.title}
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/65 leading-relaxed max-w-xl m-0">
            {PARTNERS_HERO.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#cadastro"
              className="inline-flex items-center justify-center rounded-xl bg-[#39FF14] px-6 py-3.5 text-sm sm:text-base font-bold text-[#050508] shadow-[0_0_32px_rgba(57,255,20,0.4)] hover:bg-[#5dff3a] transition-all active:scale-[0.98]"
            >
              {PARTNERS_HERO.ctaPrimary}
            </a>
            <a
              href="#como-funciona"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white/90 hover:bg-white/5 transition-colors"
            >
              {PARTNERS_HERO.ctaSecondary}
            </a>
          </div>
          <ul className="mt-10 flex flex-wrap gap-4 text-xs text-white/50 list-none p-0 m-0">
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#39FF14]" aria-hidden />
              Preços por localização
            </li>
            <li className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#39FF14]" aria-hidden />
              Alertas de queda
            </li>
            <li className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-[#39FF14]" aria-hidden />
              Estoque por nota/foto
            </li>
          </ul>
        </div>

        <div
          className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6 sm:p-8 backdrop-blur-sm"
          aria-hidden
        >
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#39FF14]/60 to-transparent" />
          <p className="text-sm font-semibold text-[#39FF14] m-0 mb-4">Compras inteligentes</p>
          <div className="space-y-3">
            <div className="rounded-2xl bg-[#0c0c12] border border-[#39FF14]/30 p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 m-0">Alerta de preço</p>
              <p className="text-lg font-bold text-white mt-1 m-0">Óleo 900 ml caiu para R$ 5,89</p>
              <p className="text-xs text-white/50 mt-1 m-0">Atacarejo a 2,1 km · melhor opção agora</p>
            </div>
            <div className="rounded-2xl bg-[#0c0c12] border border-white/10 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-white/50 m-0">Lista da semana</p>
                <p className="text-sm font-semibold text-white m-0">12 insumos comparados perto da loja</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#39FF14]/20 text-[#39FF14] text-xs font-bold px-3 py-1">
                Comprar
              </span>
            </div>
            <div className="rounded-2xl bg-[#0c0c12] border border-white/10 p-4">
              <p className="text-xs text-white/50 m-0">Entrada automatizada</p>
              <p className="text-sm font-semibold text-[#39FF14] m-0 mt-1">Nota/foto atualiza o estoque</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

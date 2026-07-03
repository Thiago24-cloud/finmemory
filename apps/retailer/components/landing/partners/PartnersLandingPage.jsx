'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { CONTACT_EMAIL } from '../../../lib/landingConstants';
import { PartnersHero } from './PartnersHero';
import { PartnersBenefitsGrid } from './PartnersBenefitsGrid';
import { PartnersHowItWorks } from './PartnersHowItWorks';
import { PartnersPickupSection } from './PartnersPickupSection';
import { PartnersOnboardingForm } from './PartnersOnboardingForm';

const NAV = [
  { href: '#beneficios', label: 'Benefícios' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#compras', label: 'Compras inteligentes' },
  { href: '#cadastro', label: 'Cadastrar loja' },
];

export function PartnersLandingPage({ socialProviders = [] }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="finmemory-light-shell min-h-screen bg-[#050508] text-white scroll-smooth selection:bg-[#39FF14]/30">
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#050508]/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image src="/logo.png" alt="FinMemory" width={36} height={36} className="rounded-lg" />
            <span className="font-bold text-lg tracking-tight">
              FinMemory <span className="text-[#39FF14]">Parceiros</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8" aria-label="Menu parceiros">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-white/70 hover:text-[#39FF14] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/login?callbackUrl=%2Fparceiros%2Fpainel"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Já sou parceiro
            </Link>
            <a
              href="#cadastro"
              className="inline-flex items-center justify-center rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-bold text-[#050508] shadow-[0_0_24px_rgba(57,255,20,0.35)] hover:bg-[#5dff3a] transition-all active:scale-[0.98]"
            >
              Começar grátis
            </a>
          </div>

          <button
            type="button"
            className="lg:hidden p-2 text-white"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen ? (
          <nav className="lg:hidden border-t border-white/10 px-4 py-4 flex flex-col gap-3 bg-[#050508]">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="py-2 text-sm font-medium text-white/80"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login?callbackUrl=%2Fparceiros%2Fpainel"
              onClick={() => setMenuOpen(false)}
              className="py-2 text-sm text-white/60"
            >
              Já sou parceiro
            </Link>
            <a
              href="#cadastro"
              onClick={() => setMenuOpen(false)}
              className="mt-1 inline-flex justify-center rounded-xl bg-[#39FF14] py-3 font-bold text-[#050508]"
            >
              Começar grátis
            </a>
          </nav>
        ) : null}
      </header>

      <main className="pt-16">
        <PartnersHero />
        <PartnersBenefitsGrid />
        <PartnersHowItWorks />
        <PartnersPickupSection />
        <PartnersOnboardingForm socialProviders={socialProviders} />
      </main>

      <footer className="border-t border-white/10 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50">
          <p className="m-0">© {new Date().getFullYear()} FinMemory · finmemory.com.br</p>
          <p className="m-0">
            Dúvidas:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#39FF14] hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

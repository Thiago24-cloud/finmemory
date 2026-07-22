'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { CONTACT_EMAIL } from '../../../lib/landingConstants';
import { PartnersHero } from './PartnersHero';
import { PartnersProblemSection } from './PartnersProblemSection';
import { PartnersBenefitsGrid } from './PartnersBenefitsGrid';
import { PartnersHowItWorks } from './PartnersHowItWorks';
import { PartnersAudienceSection } from './PartnersAudienceSection';
import { PartnersClosingSection } from './PartnersClosingSection';
import { PartnersOnboardingForm } from './PartnersOnboardingForm';

const NAV = [
  { href: '#inicio', label: 'Início' },
  { href: '#servicos', label: 'Serviços' },
  { href: '#como-funciona', label: 'Como funciona' },
];

export function PartnersLandingPage({ socialProviders = [] }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="finmemory-light-shell min-h-screen bg-[#f7fbf8] text-[#0b1f3a] scroll-smooth selection:bg-[#16a34a]/25 font-sans">
      <header className="fixed top-0 inset-x-0 z-50 border-b border-[#dbe7df] bg-white/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image src="/logo.png" alt="FinMemory" width={36} height={36} className="rounded-lg" />
            <span className="font-bold text-lg tracking-tight text-[#0b1f3a]">
              FinMemory
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8" aria-label="Menu">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-[#334155] hover:text-[#15803d] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login?callbackUrl=%2Fparceiros%2Fpainel"
              className="text-sm text-[#64748b] hover:text-[#0b1f3a] transition-colors"
            >
              Entrar
            </Link>
            <a
              href="#cadastro"
              className="inline-flex items-center justify-center rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(22,163,74,0.28)] hover:bg-[#15803d] transition-all active:scale-[0.98]"
            >
              Testar app
            </a>
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-[#0b1f3a]"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen ? (
          <nav className="md:hidden border-t border-[#dbe7df] px-4 py-4 flex flex-col gap-3 bg-white">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="py-2 text-sm font-medium text-[#334155]"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login?callbackUrl=%2Fparceiros%2Fpainel"
              onClick={() => setMenuOpen(false)}
              className="py-2 text-sm text-[#64748b]"
            >
              Entrar
            </Link>
            <a
              href="#cadastro"
              onClick={() => setMenuOpen(false)}
              className="mt-1 inline-flex justify-center rounded-xl bg-[#16a34a] py-3 font-bold text-white"
            >
              Testar app
            </a>
          </nav>
        ) : null}
      </header>

      <main className="pt-16">
        <PartnersHero />
        <PartnersProblemSection />
        <PartnersBenefitsGrid />
        <PartnersHowItWorks />
        <PartnersAudienceSection />
        <PartnersClosingSection />
        <PartnersOnboardingForm socialProviders={socialProviders} />
      </main>

      <footer className="border-t border-[#dbe7df] bg-white py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#64748b]">
          <p className="m-0">© {new Date().getFullYear()} FinMemory · finmemory.com.br</p>
          <p className="m-0">
            Dúvidas:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#16a34a] hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

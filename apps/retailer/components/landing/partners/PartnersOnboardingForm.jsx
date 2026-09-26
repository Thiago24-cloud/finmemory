'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PARTNERS_FORM } from '../../../lib/partners/landingCopy';
import { SocialLoginButtons } from '../../auth/SocialLoginButtons';

const PANEL_URL = '/parceiros/painel';
const LOGIN_URL = '/login?callbackUrl=%2Fparceiros%2Fpainel';
const SIGNUP_URL = '/login?mode=signup&callbackUrl=%2Fparceiros%2Fpainel';

export function PartnersOnboardingForm({ socialProviders = [] }) {
  const { data: session, status } = useSession();
  const loggedIn = status === 'authenticated' && Boolean(session?.user?.email);

  return (
    <section id="cadastro" className="px-4 sm:px-6 py-14 sm:py-20 scroll-mt-20 bg-white border-t border-[#dbe7df]">
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#0b1f3a] m-0">
          {PARTNERS_FORM.title}
        </h2>
        <p className="text-center text-[#475569] mt-3 m-0">
          {loggedIn ? 'Você já está logado. Entre no painel para começar.' : PARTNERS_FORM.subtitle}
        </p>

        <div className="mt-10 rounded-3xl border border-[#dbe7df] bg-[#f7fbf8] p-6 sm:p-8 shadow-[0_12px_32px_rgba(11,31,58,0.05)]">
          {loggedIn ? (
            <div className="space-y-5 text-center">
              <p className="text-sm text-[#475569] m-0 rounded-xl border border-[#dbe7df] bg-white px-4 py-3">
                Conta atual: <strong className="text-[#0b1f3a]">{session?.user?.email}</strong>
              </p>
              <Link
                href={PANEL_URL}
                className="w-full inline-flex items-center justify-center rounded-xl bg-[#16a34a] py-4 text-base font-bold text-white shadow-[0_10px_26px_rgba(22,163,74,0.28)] hover:bg-[#15803d] transition-all active:scale-[0.98]"
              >
                Ir para o painel
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <SocialLoginButtons providers={socialProviders} callbackUrl={PANEL_URL} variant="light" />
              <Link
                href={SIGNUP_URL}
                className="w-full inline-flex items-center justify-center rounded-xl bg-[#16a34a] py-4 text-base font-bold text-white shadow-[0_10px_26px_rgba(22,163,74,0.28)] hover:bg-[#15803d] transition-all active:scale-[0.98]"
              >
                Criar conta com e-mail
              </Link>
              <Link
                href={LOGIN_URL}
                className="w-full inline-flex items-center justify-center rounded-xl border border-[#cbd5e1] bg-white py-3.5 text-sm font-semibold text-[#0b1f3a] hover:bg-[#f8fafc] transition-colors"
              >
                Já tenho conta
              </Link>
            </div>
          )}

          <p className="text-[11px] text-[#64748b] text-center m-0 mt-5 leading-relaxed">
            Ao cadastrar, você concorda com nossos{' '}
            <Link href="/termos" className="text-[#16a34a] hover:underline">
              Termos
            </Link>{' '}
            e{' '}
            <Link href="/privacidade" className="text-[#16a34a] hover:underline">
              Privacidade
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

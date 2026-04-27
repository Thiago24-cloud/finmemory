import { useEffect, useCallback, useState } from 'react';
import { Sparkles, ChevronRight, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { setDashboardOnboardingDoneLocal } from '../../lib/dashboardOnboardingStorage';
import { BRAND_APP_NAME, MONTH_FILTER, BOTTOM_NAV } from '../../lib/appMicrocopy';

const STEPS = [
  {
    title: `Bem-vindo ao ${BRAND_APP_NAME}`,
    body: 'Primeira vez? Em poucos passos mostramos o essencial. Pode saltar a qualquer momento.',
  },
  {
    title: 'Saldo e mês',
    body: `No topo vê o resumo. O filtro “${MONTH_FILTER.label}” foca um mês.`,
  },
  {
    title: 'Escanear e mapa',
    body: 'NF-e: foto ou QR. Mapa: preços e ofertas perto de si.',
  },
  {
    title: 'Atalhos',
    body: 'A grelha colorida: código de barras, parceria, lista, relatórios, categorias e mais.',
  },
  {
    title: 'Histórico',
    body: 'As compras ficam abaixo. Busque por loja, categoria ou produto.',
  },
  {
    title: 'Menu inferior',
    body: `${BOTTOM_NAV.map}, ${BOTTOM_NAV.spending}, ${BOTTOM_NAV.simulador} e ${BOTTOM_NAV.profile} — sempre à mão.`,
  },
];

/**
 * Tour na primeira visita ao dashboard (Supabase + fallback localStorage).
 */
export function DashboardOnboardingTour({ userId, onComplete, className }) {
  const [step, setStep] = useState(0);

  const finish = useCallback(async () => {
    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: '{}',
      });
    } catch (_) {
      /* ignora */
    }
    if (userId) setDashboardOnboardingDoneLocal(userId);
    onComplete?.();
  }, [onComplete, userId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const isLast = step >= STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6',
        'bg-black/55 backdrop-blur-[2px]',
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
      aria-describedby="onboarding-tour-desc"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-neutral-200/80 overflow-hidden">
        <div className="relative px-5 pt-5 pb-4 border-b border-neutral-100 bg-gradient-to-br from-[#f0fdf4] to-white">
          <button
            type="button"
            onClick={finish}
            className="absolute top-3 right-3 p-2 rounded-full text-neutral-500 hover:bg-neutral-100 transition-colors"
            aria-label="Fechar tour"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-[#15803d] mb-1">
            <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide">Primeira vez</span>
          </div>
          <h2 id="onboarding-tour-title" className="text-lg font-bold text-neutral-900 pr-8">
            {current.title}
          </h2>
        </div>
        <div className="px-5 py-4">
          <p id="onboarding-tour-desc" className="text-sm text-neutral-600 leading-relaxed">
            {current.body}
          </p>
          <div className="flex justify-center gap-1.5 mt-5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === step ? 'w-6 bg-[#2ECC49]' : 'w-1.5 bg-neutral-300'
                )}
              />
            ))}
          </div>
        </div>
        <div className="px-5 pb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-800 py-2 px-1"
          >
            Pular
          </button>
          {!isLast ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2ECC49] text-white font-semibold text-sm px-5 py-2.5 hover:bg-[#22a83a] transition-colors shadow-sm"
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2ECC49] text-white font-semibold text-sm px-5 py-2.5 hover:bg-[#22a83a] transition-colors shadow-sm"
            >
              Começar
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

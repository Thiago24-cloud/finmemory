'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';

/**
 * Bloqueio amigável de feature por plano B2B.
 */
export function PlanLockedNotice({
  featureLabel = 'Esta funcionalidade',
  requiredPlanName = 'superior',
  currentPlanName = null,
  trialEndsAt = null,
}) {
  return (
    <div
      className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center space-y-3"
      role="status"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
        <Lock className="h-6 w-6 text-amber-800" aria-hidden />
      </div>
      <h2 className="text-lg font-bold text-amber-950 m-0">{featureLabel}</h2>
      <p className="text-sm text-amber-900/90 m-0 max-w-md mx-auto">
        Essa funcionalidade está disponível no plano <strong>{requiredPlanName}</strong>.
      </p>
      {currentPlanName ? (
        <p className="text-xs text-amber-800/80 m-0">Seu plano atual: {currentPlanName}</p>
      ) : null}
      {trialEndsAt ? (
        <p className="text-xs text-amber-800/80 m-0">
          Trial até {new Date(trialEndsAt).toLocaleDateString('pt-BR')}
        </p>
      ) : null}
      <Link
        href="/parceiros#pacotes"
        className="inline-flex mt-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
      >
        Ver planos
      </Link>
    </div>
  );
}

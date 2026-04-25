import { Lock } from 'lucide-react';
import Link from 'next/link';
import { usePlan } from '../hooks/usePlan';
import { FEATURE_PLANS, PLAN_LABELS } from '../lib/planAccess';

/**
 * Envolve qualquer conteúdo pago com blur + overlay de cadeado.
 *
 * @param {string} feature  - chave de FEATURE_PLANS (ex: 'radar', 'open_finance', 'relatorios')
 * @param {string} [title]  - título personalizado no overlay (opcional)
 * @param {string} [body]   - texto personalizado no overlay (opcional)
 */
export default function PlanGuard({ feature, title, body, children, className = '' }) {
  const { can, loading } = usePlan();

  if (loading) return <>{children}</>;
  if (can(feature)) return <>{children}</>;

  const requiredPlan = FEATURE_PLANS[feature] || 'pro';
  const planLabel = PLAN_LABELS[requiredPlan] || 'Pro';

  const defaultTitle = `Funcionalidade exclusiva do Plano ${planLabel}`;
  const defaultBody = 'Assine agora para liberar o acesso total ao seu mapa de preços.';

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      {/* conteúdo desfocado — só visual, não interagível */}
      <div className="pointer-events-none select-none blur-md brightness-90 saturate-50" aria-hidden="true">
        {children}
      </div>

      {/* overlay de cadeado */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/80 px-6 py-8 backdrop-blur-[2px]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 shadow-inner">
          <Lock className="h-6 w-6 text-blue-600" strokeWidth={2.5} />
        </div>
        <p className="max-w-xs text-center text-sm font-semibold text-gray-900">
          {title || defaultTitle}
        </p>
        <p className="max-w-xs text-center text-xs leading-relaxed text-gray-500">
          {body || defaultBody}
        </p>
        <Link
          href="/planos"
          className="mt-1 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.97]"
        >
          Ver Planos
        </Link>
      </div>
    </div>
  );
}

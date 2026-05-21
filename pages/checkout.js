import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { checkoutPlanOrDefault } from '../lib/stripePlanPrice';
import { PLAN_LABELS } from '../lib/planAccess';

const StripeEmbeddedCheckout = dynamic(
  () => import('../components/stripe/StripeEmbeddedCheckout'),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
        <p className="text-sm">A preparar pagamento seguro…</p>
      </div>
    ),
  }
);

/**
 * Pagamento Stripe embutido (sem sair para checkout.stripe.com).
 * Query: ?plan=pro|familia|enterprise
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { status } = useSession();
  const plan = checkoutPlanOrDefault(
    typeof router.query.plan === 'string' ? router.query.plan : undefined
  );
  const label = PLAN_LABELS[plan] || plan;

  useEffect(() => {
    if (!router.isReady || status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/checkout?plan=${plan}`)}`);
    }
  }, [router.isReady, status, router, plan]);

  if (!router.isReady || status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
        <p className="text-sm">A carregar…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-lg mx-auto px-4 py-6 pb-12">
        <Link
          href="/planos"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar aos planos
        </Link>

        <header className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">Pagamento seguro</h1>
          <p className="mt-1 text-sm text-gray-600">
            Plano <strong className="text-gray-900">{label}</strong> · processado pelo Stripe
          </p>
        </header>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden min-h-[520px]">
          <StripeEmbeddedCheckout plan={plan} />
        </div>

        <p className="mt-4 text-center text-[11px] text-gray-500">
          Ao concluir, você volta aos Ajustes com o plano ativo. Dúvidas: suporte FinMemory.
        </p>
      </div>
    </div>
  );
}

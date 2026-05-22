import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { checkoutPlanOrDefault } from '../lib/stripePlanPrice';
import { PLAN_LABELS } from '../lib/planAccess';

/**
 * Links antigos /checkout?plan=… — redireciona para Stripe Checkout hospedado (sem iframe embutido).
 */
export default function CheckoutRedirectPage() {
  const router = useRouter();
  const { status } = useSession();
  const startedRef = useRef(false);
  const [err, setErr] = useState('');

  const plan = checkoutPlanOrDefault(
    typeof router.query.plan === 'string' ? router.query.plan : undefined
  );
  const label = PLAN_LABELS[plan] || plan;

  useEffect(() => {
    if (!router.isReady || status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/checkout?plan=${plan}`)}`);
      return;
    }
    if (status !== 'authenticated' || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ plan, uiMode: 'hosted' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
        }
        if (data.url) {
          window.location.replace(data.url);
          return;
        }
        throw new Error('Link de pagamento indisponível.');
      } catch (e) {
        startedRef.current = false;
        setErr(e?.message || 'Erro ao abrir pagamento');
      }
    })();
  }, [router.isReady, status, router, plan]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <div className="max-w-lg mx-auto px-4 py-8 w-full flex-1 flex flex-col">
        <Link
          href="/planos"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar aos planos
        </Link>

        <h1 className="text-xl font-bold text-gray-900">A abrir pagamento seguro</h1>
        <p className="mt-1 text-sm text-gray-600">
          Plano <strong>{label}</strong> · você será redirecionado ao Stripe
        </p>

        {err ? (
          <p className="mt-6 text-sm text-red-600" role="alert">
            {err}
          </p>
        ) : (
          <div className="mt-10 flex flex-col items-center gap-3 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
            <p className="text-sm">Aguarde… não feche esta página.</p>
          </div>
        )}
      </div>
    </div>
  );
}

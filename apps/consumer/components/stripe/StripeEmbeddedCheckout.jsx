'use client';

import { useCallback, useMemo } from 'react';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

let stripePromise;
function getStripe() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  if (!stripePromise) stripePromise = loadStripe(key);
  return stripePromise;
}

/**
 * Checkout Stripe embutido em finmemory.com.br/checkout — evita redirect para checkout.stripe.com
 * e reduz piscar de botões causado por reload / Link / wallets no redirect.
 */
export default function StripeEmbeddedCheckout({ plan = 'pro' }) {
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ plan, uiMode: 'embedded' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
    }
    if (!data.clientSecret) {
      throw new Error('Resposta inválida do servidor (sem clientSecret).');
    }
    return data.clientSecret;
  }, [plan]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);
  const stripe = getStripe();

  if (!stripe) {
    return (
      <p className="text-sm text-red-600" role="alert">
        Pagamento indisponível: chave pública Stripe não configurada no app.
      </p>
    );
  }

  return (
    <EmbeddedCheckoutProvider stripe={stripe} options={options}>
      <EmbeddedCheckout className="w-full min-h-[480px]" />
    </EmbeddedCheckoutProvider>
  );
}

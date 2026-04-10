import { useCallback, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const publishableKey =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : '';

let stripePromise;
function getStripe() {
  if (!publishableKey) return null;
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

/**
 * Inicia Checkout Stripe (FinMemory Plus). O utilizador tem de estar logado; o servidor usa a sessão NextAuth.
 * Props opcionais userId / userEmail reservadas para analytics futuros (não são enviadas ao servidor aqui).
 */
export default function UpgradeButton({
  className = '',
  children,
  userId: _userId,
  userEmail: _userEmail,
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const onClick = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const r = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: '{}',
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      const stripe = await getStripe();
      if (!stripe || !data.sessionId) throw new Error('Stripe.js ou sessão em falta.');
      const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (error) throw error;
    } catch (e) {
      setErr(e?.message || 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  if (!publishableKey) {
    return null;
  }

  return (
    <div>
      <button type="button" className={className} onClick={onClick} disabled={loading}>
        {loading ? 'A abrir…' : children || 'FinMemory Plus'}
      </button>
      {err ? (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}

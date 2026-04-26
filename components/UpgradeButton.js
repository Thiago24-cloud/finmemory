import { useCallback, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

let stripePromise;
function getStripe() {
  const publishableKey =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : '';
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
  /** @type {'plus' | 'pro' | 'familia'} */
  plan = 'plus',
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
        body: JSON.stringify({ plan }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 401) {
          if (typeof window !== 'undefined') {
            const cb = encodeURIComponent('/planos');
            window.location.href = `/login?callbackUrl=${cb}`;
            return;
          }
        }
        throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
      }
      if (data.url) {
        // Alguns browsers/webviews são sensíveis ao fluxo assíncrono;
        // forçamos navegação no mesmo separador com fallback.
        window.location.assign(data.url);
        setTimeout(() => {
          try {
            window.open(data.url, '_self');
          } catch (_) {
            // noop
          }
        }, 150);
        return;
      }
      const stripe = await getStripe();
      if (!stripe || !data.sessionId) {
        throw new Error(
          'Checkout não pôde abrir pelo fallback Stripe.js. Verifique NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY e tente novamente.'
        );
      }
      const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (error) throw error;
    } catch (e) {
      // Deixa rastro para inspeção no browser em casos de "clique sem ação".
      console.error('[stripe/upgrade-button]', e);
      setErr(e?.message || 'Erro');
    } finally {
      setLoading(false);
    }
  }, [plan]);

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

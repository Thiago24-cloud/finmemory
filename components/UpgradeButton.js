import { useCallback, useRef, useState } from 'react';

/**
 * Inicia Checkout Stripe (FinMemory planos pagos). O utilizador tem de estar logado; o servidor usa a sessão NextAuth.
 * Fluxo: /checkout?plan=… (Stripe embutido no site — menos piscar que redirect para checkout.stripe.com).
 */
export default function UpgradeButton({
  className = '',
  children,
  /** @type {'pro' | 'familia' | 'enterprise'} */
  plan = 'pro',
  userId: _userId,
  userEmail: _userEmail,
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const navigatingRef = useRef(false);

  const onClick = useCallback(async () => {
    if (navigatingRef.current) return;
    setErr('');
    setLoading(true);
    try {
      const callbackPath =
        typeof window !== 'undefined'
          ? `/checkout?plan=${encodeURIComponent(plan)}`
          : '/checkout';

      if (typeof window === 'undefined') return;

      navigatingRef.current = true;
      window.location.replace(callbackPath);
    } catch (e) {
      console.error('[stripe/upgrade-button]', e);
      navigatingRef.current = false;
      setErr(e?.message || 'Erro ao abrir pagamento');
      setLoading(false);
    }
  }, [plan]);

  return (
    <div>
      <button type="button" className={className} onClick={onClick} disabled={loading}>
        {loading ? 'A abrir…' : children || 'Assinar FinMemory'}
      </button>
      {err ? (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}

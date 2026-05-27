import { useCallback, useRef, useState } from 'react';

/**
 * Checkout Stripe hospedado (checkout.stripe.com) — fluxo estável em mobile e PWA.
 * Sessão NextAuth no servidor; não usa página /checkout embutida.
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
  const busyRef = useRef(false);

  const onClick = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setErr('');
    setLoading(true);

    const callbackPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search || ''}`
        : '/planos';

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan, uiMode: 'hosted' }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401 && typeof window !== 'undefined') {
          window.location.href = `/login?callbackUrl=${encodeURIComponent(callbackPath)}`;
          return;
        }
        const detail = Array.isArray(data.issues) && data.issues[0] ? ` (${data.issues[0]})` : '';
        throw new Error((data.error || 'Não foi possível iniciar o pagamento.') + detail);
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error('O Stripe não devolveu o link de pagamento. Tente novamente.');
    } catch (e) {
      console.error('[stripe/upgrade-button]', e);
      busyRef.current = false;
      setErr(e?.message || 'Erro ao abrir pagamento');
      setLoading(false);
    }
  }, [plan]);

  return (
    <div>
      <button type="button" className={className} onClick={onClick} disabled={loading}>
        {loading ? 'A abrir pagamento…' : children || 'Assinar FinMemory'}
      </button>
      {err ? (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}

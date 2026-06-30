import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 4000;

/**
 * Hook de checkout Cielo (Pix por defeito).
 * Estruturado para UI premium dark — ver CieloCheckoutPanel.
 */
export function useCieloCheckout({
  amountCents,
  description,
  paymentMethod = 'pix',
  pollWhilePending = true,
}) {
  const [phase, setPhase] = useState('idle'); // idle | creating | pix | confirmed | failed
  const [error, setError] = useState('');
  const [payment, setPayment] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(
    async (paymentId) => {
      const res = await fetch(`/api/payments/cielo/status/${encodeURIComponent(paymentId)}`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível verificar o pagamento.');
      }
      return data;
    },
    [],
  );

  const startPayment = useCallback(async () => {
    setError('');
    setPhase('creating');
    setPayment(null);
    stopPolling();

    try {
      const res = await fetch('/api/payments/cielo/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amountCents,
          description,
          paymentMethod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao iniciar pagamento.');
      }

      setPayment(data);

      if (data.isConfirmed) {
        setPhase('confirmed');
        return data;
      }

      if (paymentMethod === 'pix' && data.pix?.qrCodeBase64) {
        setPhase('pix');
      } else {
        setPhase('pix');
      }

      if (pollWhilePending && data.paymentId) {
        pollRef.current = setInterval(async () => {
          try {
            const status = await refreshStatus(data.paymentId);
            if (status.isConfirmed) {
              stopPolling();
              setPayment((prev) => ({ ...prev, ...status }));
              setPhase('confirmed');
            } else if (status.finmemoryState === 'denied' || status.finmemoryState === 'aborted') {
              stopPolling();
              setPhase('failed');
              setError(status.returnMessage || 'Pagamento não aprovado.');
            }
          } catch {
            /* polling silencioso — usuário pode tentar manualmente */
          }
        }, POLL_MS);
      }

      return data;
    } catch (e) {
      setPhase('failed');
      setError(e?.message || 'Erro no pagamento');
      throw e;
    }
  }, [amountCents, description, paymentMethod, pollWhilePending, refreshStatus, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return {
    phase,
    error,
    payment,
    startPayment,
    refreshStatus,
    stopPolling,
    isLoading: phase === 'creating',
    isConfirmed: phase === 'confirmed',
  };
}

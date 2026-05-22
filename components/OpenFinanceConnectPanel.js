'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ConnectBank from './ConnectBank';

/**
 * Conectar banco (Open Finance) — 1 banco grátis; mais bancos exigem plano pago.
 */
export default function OpenFinanceConnectPanel({ onSuccess, onError }) {
  const [limits, setLimits] = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(true);

  const loadLimits = useCallback(async () => {
    setLimitsLoading(true);
    try {
      const res = await fetch('/api/open-finance/summary', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.limits) {
        setLimits(data.limits);
      }
    } catch {
      setLimits(null);
    } finally {
      setLimitsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLimits();
  }, [loadLimits]);

  const handleSuccess = useCallback(
    (itemId) => {
      void loadLimits();
      onSuccess?.(itemId);
    },
    [loadLimits, onSuccess]
  );

  if (limitsLoading) {
    return <p className="text-sm text-gray-500">A carregar…</p>;
  }

  const canConnect = limits?.canConnectMore !== false;
  const used = limits?.used ?? 0;
  const max = limits?.max ?? 1;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">
        {max <= 1
          ? 'Plano Grátis: 1 banco ligado, sem limite de tempo.'
          : `Seu plano: até ${max} bancos ligados.`}{' '}
        <span className="text-gray-500">
          ({used}/{max} em uso)
        </span>
      </p>

      {canConnect ? (
        <ConnectBank onSuccess={handleSuccess} onError={onError} />
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Limite de bancos atingido</p>
          <p className="mt-1 text-amber-900/90">
            Para ligar outro banco, assine um plano pago (Pro, Família ou Enterprise).
          </p>
          <Link
            href="/planos"
            className="mt-3 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Ver planos
          </Link>
        </div>
      )}
    </div>
  );
}

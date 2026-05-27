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
    return <p className="text-sm text-foreground/70">A carregar…</p>;
  }

  const canConnect = limits?.canConnectMore !== false;
  const used = limits?.used ?? 0;
  const max = limits?.max ?? 1;

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground/85">
        {max <= 1
          ? 'Plano Grátis: 1 banco ligado, sem limite de tempo.'
          : `Seu plano: até ${max} bancos ligados.`}{' '}
        <span className="text-[#2ECC49] font-medium">
          ({used}/{max} em uso)
        </span>
      </p>

      {canConnect ? (
        <ConnectBank onSuccess={handleSuccess} onError={onError} />
      ) : (
        <div className="rounded-xl border border-amber-500/35 bg-amber-950/40 px-4 py-3 text-sm">
          <p className="font-semibold text-[#2ECC49]">Limite de bancos atingido</p>
          <p className="mt-1 text-foreground/85">
            Para ligar outro banco, assine um plano pago (Pro, Família ou Enterprise).
          </p>
          <Link
            href="/planos"
            className="mt-3 inline-flex rounded-lg bg-[#2ECC49] px-4 py-2 text-sm font-semibold text-white hover:bg-[#25b340]"
          >
            Ver planos
          </Link>
        </div>
      )}
    </div>
  );
}

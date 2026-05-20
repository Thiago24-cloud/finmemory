'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateSaldoHoje,
  resolveContasForSaldo,
} from '../lib/finance/contaFinanceira';

/**
 * Saldo de Hoje no Simulador — recalcula quando `contas` ou hints mudam;
 * opcionalmente dispara `onRefresh` ao voltar à aba (focus / visibility).
 *
 * @param {{
 *   contas?: import('../lib/finance/contaFinanceira').ContaFinanceira[] | null,
 *   saldoHojeFromApi?: number | null,
 *   enabled?: boolean,
 *   onRefresh?: () => void | Promise<void>,
 * }} options
 */
export function useSaldoDeHoje({
  contas: contasProp,
  saldoHojeFromApi,
  enabled = true,
  onRefresh,
} = {}) {
  const [tick, setTick] = useState(0);
  const touchedRef = useRef(false);

  const contas = useMemo(() => {
    void tick;
    return resolveContasForSaldo(contasProp);
  }, [contasProp, tick]);

  const saldoHoje = useMemo(() => {
    if (typeof saldoHojeFromApi === 'number' && Number.isFinite(saldoHojeFromApi)) {
      return saldoHojeFromApi;
    }
    return calculateSaldoHoje(contas);
  }, [contas, saldoHojeFromApi]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    await onRefresh?.();
    setTick((t) => t + 1);
  }, [enabled, onRefresh]);

  useEffect(() => {
    if (!enabled || !onRefresh) return undefined;

    const run = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [enabled, onRefresh, refresh]);

  const markTouched = useCallback(() => {
    touchedRef.current = true;
  }, []);

  const resetTouched = useCallback(() => {
    touchedRef.current = false;
  }, []);

  const wasTouched = useCallback(() => touchedRef.current, []);

  return {
    contas,
    saldoHoje,
    refresh,
    markTouched,
    resetTouched,
    wasTouched,
  };
}

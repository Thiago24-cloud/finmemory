'use client';

import { useEffect, useMemo } from 'react';

export function useBagBackgroundMonitoring(shoppingBag = []) {
  const pendingProductNames = useMemo(() => {
    return [
      ...new Set(
        (shoppingBag || [])
          .map((item) => String(item?.productName || item?.name || '').trim())
          .filter((name) => name.length >= 2)
      ),
    ];
  }, [shoppingBag]);

  const namesKey = useMemo(() => pendingProductNames.join('\u0000'), [pendingProductNames]);

  useEffect(() => {
    // MVP simplificado: monitoramento/alarmes em segundo plano desativados.
    // Mantemos o código antigo comentado para reativação futura sem retrabalho.
    /*
    let cancelled = false;

    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      if (!getProximityAlertsStored()) return;
      if (pendingProductNames.length === 0) {
        await stopProximityMonitoring();
        return;
      }

      const supabase = getSupabase();
      if (!supabase) return;

      const result = await startProximityMonitoring({
        supabase,
        pendingProductNames,
        radiusM: getProximityRadiusM(),
        onUnauthorized: (type) => {
          if (cancelled) return;
          if (type === 'location') {
            toast.message('Ative localização em segundo plano para alertas da sacola.');
          } else if (type === 'notifications') {
            toast.message('Ative notificações para receber alertas da sacola.');
          }
        },
      });

      if (cancelled) return;
      if (result?.ok === false && result.reason && result.reason !== 'web') {
        toast.message('Não foi possível ativar os alertas de proximidade da sacola.');
      }
    })();

    return () => {
      cancelled = true;
      stopProximityMonitoring({ clearTargets: false });
    };
    */
    return undefined;
  }, [namesKey, pendingProductNames]);
}


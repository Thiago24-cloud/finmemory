'use client';

import { useEffect, useRef } from 'react';
import { getSupabase } from '../lib/supabase';
import {
  ensureRealtimeAuth,
  fetchRealtimeAccessToken,
  subscribePedidosLoja,
} from '@finmemory/shared/realtime/pedidos';

/**
 * Lista de pedidos da loja em tempo real (painel lojista).
 */
export function usePedidosLojaRealtime(lojaId, onUpdate) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!lojaId) return undefined;

    let unsubscribe = () => {};
    let cancelled = false;

    (async () => {
      const supabase = getSupabase();
      if (!supabase || cancelled) return;

      const token = await fetchRealtimeAccessToken();
      if (cancelled) return;
      if (!token || !ensureRealtimeAuth(supabase, token)) return;

      unsubscribe = subscribePedidosLoja(supabase, lojaId, () => {
        onUpdateRef.current?.();
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [lojaId]);
}

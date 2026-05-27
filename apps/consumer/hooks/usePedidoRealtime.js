'use client';

import { useEffect, useRef } from 'react';
import { getSupabase } from '../lib/supabase';
import {
  ensureRealtimeAuth,
  fetchRealtimeAccessToken,
  subscribePedidoById,
} from '@finmemory/shared/realtime/pedidos';

/**
 * Atualiza pedido em tempo real via Supabase Realtime (fallback: polling do caller).
 */
export function usePedidoRealtime(pedidoId, onUpdate) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!pedidoId || typeof pedidoId !== 'string') return undefined;

    let unsubscribe = () => {};
    let cancelled = false;

    (async () => {
      const supabase = getSupabase();
      if (!supabase || cancelled) return;

      const token = await fetchRealtimeAccessToken();
      if (cancelled) return;
      if (!token || !ensureRealtimeAuth(supabase, token)) return;

      unsubscribe = subscribePedidoById(supabase, pedidoId, () => {
        onUpdateRef.current?.();
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [pedidoId]);
}

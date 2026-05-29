'use client';

import { useEffect, useRef } from 'react';
import { getSupabase } from '../lib/supabase';
import {
  ensureRealtimeAuth,
  fetchRealtimeAccessToken,
  subscribeInsumosLoja,
} from '@finmemory/shared/realtime/pedidos';

/**
 * Insumos/estoque da loja em tempo real (painel Parceiros — celular ↔ desktop).
 */
export function useInsumosLojaRealtime(lojaId, onUpdate) {
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

      unsubscribe = subscribeInsumosLoja(supabase, lojaId, () => {
        onUpdateRef.current?.();
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [lojaId]);
}

'use client';

import { useEffect, useRef } from 'react';
import { getSupabase } from '../lib/supabase';
import {
  ensureRealtimeAuth,
  fetchRealtimeAccessToken,
  subscribeProdutosLoja,
} from '@finmemory/shared/realtime/pedidos';

/**
 * Produtos/ofertas da loja em tempo real (painel Parceiros — celular ↔ desktop).
 */
export function useProdutosLojaRealtime(lojaId, onUpdate) {
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

      unsubscribe = subscribeProdutosLoja(supabase, lojaId, () => {
        onUpdateRef.current?.();
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [lojaId]);
}

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export async function fetchRealtimeAccessToken(
  apiPath = '/api/supabase/realtime-token'
): Promise<string | null> {
  try {
    const res = await fetch(apiPath, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.access_token === 'string' ? data.access_token : null;
  } catch {
    return null;
  }
}

/** Autentica canal Realtime (Supabase JS v2+). */
export function ensureRealtimeAuth(supabase: SupabaseClient, accessToken: string): boolean {
  if (!accessToken) return false;
  const rt = supabase.realtime as { setAuth?: (token: string) => void };
  if (typeof rt.setAuth === 'function') {
    rt.setAuth(accessToken);
    return true;
  }
  return false;
}

/** Lojista: mudanças em pedidos da loja. */
export function subscribePedidosLoja(
  supabase: SupabaseClient,
  lojaId: string,
  onChange: () => void
): () => void {
  const id = String(lojaId || '').trim();
  if (!id) return () => {};

  const channel: RealtimeChannel = supabase
    .channel(`pedidos-loja-${id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pedidos_loja',
        filter: `loja_id=eq.${id}`,
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Consumidor: acompanhar um pedido específico. */
export function subscribePedidoById(
  supabase: SupabaseClient,
  pedidoId: string,
  onChange: () => void
): () => void {
  const id = String(pedidoId || '').trim();
  if (!id) return () => {};

  const channel: RealtimeChannel = supabase
    .channel(`pedido-track-${id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'pedidos_loja',
        filter: `id=eq.${id}`,
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

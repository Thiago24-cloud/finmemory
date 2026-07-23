import { notifyClientePedidoStatus } from '../../push/merchantOrderPush';
import { computeEtaPrevistoEm } from './computePedidoEta';
import {
  canTransitionPedidoStatus,
  DIRECT_ORDER_STATUS,
  normalizeStatusToEnglish,
} from './pedidoStatus';

/**
 * Atualiza status (aceita EN ou PT). Preferência EN para pedido direto.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ pedidoId: string, restaurantId: string, status: string }} input
 */
export async function updateOrderStatus(supabase, input) {
  const pedidoId = String(input.pedidoId || '').trim();
  const restaurantId = String(input.restaurantId || input.lojaId || '').trim();
  const status = String(input.status || '').trim();

  const { data: existing, error: fetchErr } = await supabase
    .from('pedidos_loja')
    .select('*')
    .eq('id', pedidoId)
    .eq('loja_id', restaurantId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: 'Pedido não encontrado.' };

  if (!canTransitionPedidoStatus(existing.status, status)) {
    return {
      ok: false,
      error: `Não é possível mudar de "${existing.status}" para "${status}".`,
    };
  }

  const nowIso = new Date().toISOString();
  const patch = { status, updated_at: nowIso };
  const en = normalizeStatusToEnglish(status);

  if (en === DIRECT_ORDER_STATUS.PREPARING || status === 'preparando') {
    patch.preparo_iniciado_em = existing.preparo_iniciado_em || nowIso;
    patch.eta_previsto_em = computeEtaPrevistoEm(
      existing.tempo_preparo_minutos,
      new Date()
    );
  }
  if (
    en === DIRECT_ORDER_STATUS.READY_FOR_PICKUP ||
    en === DIRECT_ORDER_STATUS.OUT_FOR_DELIVERY ||
    status === 'pronto'
  ) {
    patch.pronto_em = existing.pronto_em || nowIso;
  }
  if (en === DIRECT_ORDER_STATUS.DELIVERED || status === 'concluido') {
    patch.concluido_em = nowIso;
  }

  const { data: updated, error: updErr } = await supabase
    .from('pedidos_loja')
    .update(patch)
    .eq('id', pedidoId)
    .eq('loja_id', restaurantId)
    .select('*')
    .single();

  if (updErr) return { ok: false, error: updErr.message };

  if (
    (en === DIRECT_ORDER_STATUS.DELIVERED || status === 'concluido') &&
    updated.origem === 'mesa' &&
    updated.mesa_id
  ) {
    await supabase
      .from('mesas_loja')
      .update({ status: 'livre', updated_at: nowIso })
      .eq('id', updated.mesa_id)
      .eq('loja_id', restaurantId);
  }

  const { data: storeRow } = await supabase
    .from('stores')
    .select('name')
    .eq('id', restaurantId)
    .maybeSingle();

  if (updated.cliente_user_id) {
    void notifyClientePedidoStatus({
      pedidoId: updated.id,
      status: updated.status,
      clienteUserId: updated.cliente_user_id,
      etaPrevistoEm: updated.eta_previsto_em,
      storeName: storeRow?.name,
    }).catch((err) => {
      console.warn('[updateOrderStatus] push:', err?.message || err);
    });
  }

  return { ok: true, pedido: updated };
}

/** Alias legado usado pelo PATCH merchant. */
export async function updatePedidoStatusForStore(supabase, input) {
  return updateOrderStatus(supabase, {
    pedidoId: input.pedidoId,
    restaurantId: input.lojaId,
    status: input.status,
  });
}

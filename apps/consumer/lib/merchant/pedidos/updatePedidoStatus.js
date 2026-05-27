import { notifyClientePedidoStatus } from '../../push/merchantOrderPush';
import { computeEtaPrevistoEm } from './computePedidoEta';
import { canTransitionPedidoStatus, PEDIDO_STATUS } from './pedidoStatus';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ pedidoId: string, lojaId: string, status: string }} input
 */
export async function updatePedidoStatusForStore(supabase, input) {
  const { pedidoId, lojaId, status } = input;

  const { data: existing, error: fetchErr } = await supabase
    .from('pedidos_loja')
    .select('*')
    .eq('id', pedidoId)
    .eq('loja_id', lojaId)
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

  if (status === PEDIDO_STATUS.PREPARANDO) {
    patch.preparo_iniciado_em = existing.preparo_iniciado_em || nowIso;
    patch.eta_previsto_em = computeEtaPrevistoEm(
      existing.tempo_preparo_minutos,
      new Date()
    );
  }
  if (status === PEDIDO_STATUS.PRONTO) {
    patch.pronto_em = nowIso;
  }
  if (status === PEDIDO_STATUS.CONCLUIDO) {
    patch.concluido_em = nowIso;
  }

  const { data: updated, error: updErr } = await supabase
    .from('pedidos_loja')
    .update(patch)
    .eq('id', pedidoId)
    .eq('loja_id', lojaId)
    .select('*')
    .single();

  if (updErr) return { ok: false, error: updErr.message };

  const { data: storeRow } = await supabase
    .from('stores')
    .select('name')
    .eq('id', lojaId)
    .maybeSingle();

  void notifyClientePedidoStatus({
    pedidoId: updated.id,
    status: updated.status,
    clienteUserId: updated.cliente_user_id,
    etaPrevistoEm: updated.eta_previsto_em,
    storeName: storeRow?.name,
  }).catch((err) => {
    console.warn('[updatePedidoStatus] push cliente:', err?.message || err);
  });

  return { ok: true, pedido: updated };
}

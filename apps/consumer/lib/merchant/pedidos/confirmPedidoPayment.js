import { notifyMerchantNewOrder } from '../../push/merchantOrderPush';
import { PEDIDO_STATUS } from './pedidoStatus';

/**
 * Após Checkout pago: confirma pedido, baixa estoque, avisa lojista.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   pedidoId: string,
 *   paymentIntentId?: string | null,
 *   checkoutSessionId?: string | null,
 * }} input
 */
export async function confirmPedidoPayment(supabase, input) {
  const pedidoId = String(input.pedidoId || '').trim();
  if (!pedidoId) return { ok: false, error: 'pedido_id ausente' };

  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos_loja')
    .select('*')
    .eq('id', pedidoId)
    .maybeSingle();

  if (pedidoErr) return { ok: false, error: pedidoErr.message };
  if (!pedido) return { ok: false, error: 'Pedido não encontrado' };
  if (pedido.payment_status === 'paid') {
    return { ok: true, already: true, pedido };
  }
  if (pedido.payment_status === 'cancelled') {
    return { ok: false, error: 'Pedido cancelado' };
  }

  const nowIso = new Date().toISOString();
  const patch = {
    payment_status: 'paid',
    updated_at: nowIso,
  };
  if (input.paymentIntentId) patch.stripe_payment_intent_id = input.paymentIntentId;
  if (input.checkoutSessionId) patch.stripe_checkout_session_id = input.checkoutSessionId;

  const { data: updated, error: updErr } = await supabase
    .from('pedidos_loja')
    .update(patch)
    .eq('id', pedidoId)
    .select('*')
    .single();

  if (updErr) return { ok: false, error: updErr.message };

  const { data: itens, error: itensErr } = await supabase
    .from('pedidos_loja_itens')
    .select('id, produto_loja_id, quantidade')
    .eq('pedido_id', pedidoId);

  if (itensErr) return { ok: false, error: itensErr.message };

  for (const li of itens || []) {
    if (!li.produto_loja_id) continue;
    const { data: prod } = await supabase
      .from('produtos_loja')
      .select('quantidade_estoque')
      .eq('id', li.produto_loja_id)
      .maybeSingle();
    if (prod?.quantidade_estoque != null) {
      const next = Math.max(0, prod.quantidade_estoque - Number(li.quantidade || 1));
      await supabase
        .from('produtos_loja')
        .update({ quantidade_estoque: next, updated_at: nowIso })
        .eq('id', li.produto_loja_id);
    }
  }

  const { data: store } = await supabase
    .from('stores')
    .select('name')
    .eq('id', updated.loja_id)
    .maybeSingle();

  void notifyMerchantNewOrder(supabase, {
    pedido: updated,
    storeName: store?.name,
    lojaId: updated.loja_id,
  }).catch((err) => {
    console.warn('[confirmPedidoPayment] push:', err?.message || err);
  });

  return { ok: true, pedido: updated };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} pedidoId
 */
export async function cancelPedidoPaymentPending(supabase, pedidoId) {
  const id = String(pedidoId || '').trim();
  if (!id) return;

  const { data: pedido } = await supabase
    .from('pedidos_loja')
    .select('id, payment_status')
    .eq('id', id)
    .maybeSingle();

  if (!pedido || pedido.payment_status !== 'pending') return;

  await supabase
    .from('pedidos_loja')
    .update({
      payment_status: 'cancelled',
      status: PEDIDO_STATUS.CANCELADO,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
}

import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { mapPedidoRowToApi } from '../../../../lib/merchant/pedidos/mapPedidoRow';
import { updatePedidoStatusForStore } from '../../../../lib/merchant/pedidos/updatePedidoStatus';
import { cancelPedidoWithRestore } from '../../../../lib/merchant/pedidos/cancelPedidoWithRestore';
import { confirmMesaPayment } from '../../../../lib/merchant/pedidos/confirmMesaPayment';
import { isValidPedidoStatus } from '../../../../lib/merchant/pedidos/pedidoStatus';

/**
 * PATCH /api/merchant/pedidos/[id]
 * Body: { status } | { action: 'cancel'|'refund'|'confirm_payment' }
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const pedidoId = String(req.query.id || '').trim();
  if (!pedidoId) {
    return res.status(400).json({ error: 'ID do pedido inválido.' });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const action = String(body.action || '').trim();

    if (action === 'cancel' || action === 'refund') {
      const result = await cancelPedidoWithRestore(auth.supabase, {
        pedidoId,
        lojaId: auth.store.id,
        mode: action,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      const { data: itens } = await auth.supabase
        .from('pedidos_loja_itens')
        .select('id, pedido_id, produto_loja_id, nome, preco_unitario, quantidade')
        .eq('pedido_id', pedidoId);
      return res.status(200).json({ order: mapPedidoRowToApi(result.pedido, itens || []) });
    }

    if (action === 'confirm_payment') {
      const result = await confirmMesaPayment(auth.supabase, {
        lojaId: auth.store.id,
        pedidoIds: [pedidoId],
        mesaId: body.mesa_id || null,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      const { data: pedido } = await auth.supabase
        .from('pedidos_loja')
        .select('*')
        .eq('id', pedidoId)
        .single();
      const { data: itens } = await auth.supabase
        .from('pedidos_loja_itens')
        .select('id, pedido_id, produto_loja_id, nome, preco_unitario, quantidade')
        .eq('pedido_id', pedidoId);
      return res.status(200).json({ order: mapPedidoRowToApi(pedido, itens || []) });
    }

    const status = String(body.status || '').trim();
    if (!isValidPedidoStatus(status)) {
      return res.status(400).json({ error: 'Status inválido.' });
    }

    const result = await updatePedidoStatusForStore(auth.supabase, {
      pedidoId,
      lojaId: auth.store.id,
      status,
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    const { data: itens } = await auth.supabase
      .from('pedidos_loja_itens')
      .select('id, pedido_id, produto_loja_id, nome, preco_unitario, quantidade')
      .eq('pedido_id', pedidoId);

    return res.status(200).json({
      order: mapPedidoRowToApi(result.pedido, itens || []),
    });
  }

  res.setHeader('Allow', 'PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}

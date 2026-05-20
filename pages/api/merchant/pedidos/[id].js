import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { mapPedidoRowToApi } from '../../../../lib/merchant/pedidos/mapPedidoRow';
import { updatePedidoStatusForStore } from '../../../../lib/merchant/pedidos/updatePedidoStatus';
import { isValidPedidoStatus } from '../../../../lib/merchant/pedidos/pedidoStatus';

/**
 * PATCH /api/merchant/pedidos/[id] — { status: 'preparando' | 'pronto' | 'concluido' | 'cancelado' }
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const pedidoId = String(req.query.id || '').trim();
  if (!pedidoId) {
    return res.status(400).json({ error: 'ID do pedido inválido.' });
  }

  if (req.method === 'PATCH') {
    const status = String(req.body?.status || '').trim();
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

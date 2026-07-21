import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { confirmMesaPayment } from '../../../../lib/merchant/pedidos/confirmMesaPayment';

/** POST /api/merchant/caixa/pagar — confirma pagamento de vários pedidos da mesa. */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const pedidoIds = Array.isArray(body.pedido_ids)
    ? body.pedido_ids.map(String).filter(Boolean)
    : body.pedido_id
      ? [String(body.pedido_id)]
      : [];

  const result = await confirmMesaPayment(auth.supabase, {
    lojaId: auth.store.id,
    pedidoIds,
    mesaId: body.mesa_id || null,
    formaPagamento: body.forma_pagamento || body.formaPagamento || body.metodo || null,
  });

  if (!result.ok) return res.status(400).json({ error: result.error });
  return res.status(200).json({
    success: true,
    paid_count: result.paid_count,
    forma_pagamento: body.forma_pagamento || body.formaPagamento || body.metodo || null,
  });
}

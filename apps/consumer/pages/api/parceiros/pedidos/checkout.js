import { requireConsumerSession } from '../../../../lib/merchant/requireConsumerSession';
import { createPedidoCheckout } from '../../../../lib/merchant/pedidos/createPedidoCheckout';

/**
 * POST /api/parceiros/pedidos/checkout — Stripe Checkout (Connect) antes de liberar o pedido.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireConsumerSession(req, res);
  if (!auth) return;

  const body = req.body || {};
  const lojaId = String(body.loja_id || body.lojaId || '').trim();
  const items = Array.isArray(body.items) ? body.items : [];
  const observacao = body.observacao || body.note || null;

  const result = await createPedidoCheckout(auth.supabase, {
    lojaId,
    clienteUserId: auth.userId,
    clienteEmail: auth.email || '',
    items,
    observacao,
  });

  if (!result.ok) {
    const status = result.code === 'STORE_PAYMENTS_NOT_READY' ? 400 : 400;
    return res.status(status).json({
      error: result.error,
      code: result.code || null,
    });
  }

  return res.status(200).json({
    url: result.url,
    sessionId: result.sessionId,
    pedido_id: result.pedido_id,
  });
}

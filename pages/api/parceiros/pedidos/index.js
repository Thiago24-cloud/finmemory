import { requireConsumerSession } from '../../../../lib/merchant/requireConsumerSession';
import { createPedidoLoja } from '../../../../lib/merchant/pedidos/createPedidoLoja';
import { mapPedidoRowToApi } from '../../../../lib/merchant/pedidos/mapPedidoRow';
import { isStoreStripeConnectReady } from '../../../../lib/stripe/connectMerchant';
import { isStripeConnectOrdersEnabled } from '../../../../lib/stripe/stripeClient';

/**
 * POST /api/parceiros/pedidos — consumidor cria pedido de retirada.
 * Body: { loja_id, items: [{ produto_loja_id, quantidade }], observacao? }
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

  if (isStripeConnectOrdersEnabled() && lojaId) {
    const { data: store } = await auth.supabase
      .from('stores')
      .select('stripe_connect_account_id, stripe_connect_charges_enabled')
      .eq('id', lojaId)
      .maybeSingle();
    if (isStoreStripeConnectReady(store)) {
      return res.status(402).json({
        error: 'Esta loja exige pagamento online. Use o checkout.',
        code: 'PAYMENT_REQUIRED',
        checkout_url: '/api/parceiros/pedidos/checkout',
      });
    }
  }

  const result = await createPedidoLoja(auth.supabase, {
    lojaId,
    clienteUserId: auth.userId,
    items,
    observacao,
  });

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json({
    order: mapPedidoRowToApi(result.pedido, result.itens),
    store_name: result.store_name,
    message: 'Pedido enviado! Acompanhe o tempo de preparo.',
  });
}

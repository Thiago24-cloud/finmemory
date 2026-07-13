/** POST /api/parceiros/pedir/order — envia pedido da mesa para a cozinha. */
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { createPedidoMesa } from '../../../../lib/merchant/pedidos/createPedidoMesa';
import { mapPedidoRowToApi } from '../../../../lib/merchant/pedidos/mapPedidoRow';
import { checkRateLimit, getRequestIp } from '../../../../lib/rateLimit';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getRequestIp(req);
  const rate = checkRateLimit({
    bucket: 'mesa-pedir-order',
    key: ip,
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    return res.status(429).json({ error: 'Muitos pedidos. Aguarde um momento.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Serviço indisponível' });
  }

  const body = req.body || {};
  const lojaId = String(body.loja || body.loja_id || '').trim();
  const mesaNumero = parseInt(String(body.mesa ?? body.mesa_numero), 10);
  const items = Array.isArray(body.items) ? body.items : [];
  const observacao = body.observacao || body.note || null;

  if (!lojaId) {
    return res.status(400).json({ error: 'Loja obrigatória.' });
  }
  if (!Number.isFinite(mesaNumero) || mesaNumero < 0) {
    return res.status(400).json({ error: 'Número da mesa obrigatório.' });
  }

  const result = await createPedidoMesa(supabase, {
    lojaId,
    mesaNumero,
    items,
    observacao,
  });

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json({
    order: mapPedidoRowToApi(result.pedido, result.itens),
    store_name: result.store_name,
    mesa_numero: result.mesa_numero,
    message: 'Pedido enviado para a cozinha!',
  });
}

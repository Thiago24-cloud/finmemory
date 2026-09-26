import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { mapPedidoRowToApi } from '../../../../lib/merchant/pedidos/mapPedidoRow';
import { listPedidosForStore } from '../../../../lib/merchant/pedidos/listPedidosForStore';

/**
 * GET /api/merchant/pedidos — pedidos da loja (tenant).
 * Query: scope=cozinha|garcom|caixa|historico|entrega|default, status, origem, mesa, limit
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { supabase, store } = auth;
  const scope = String(req.query.scope || 'default').trim();
  const limit = parseInt(String(req.query.limit || (scope === 'historico' ? 100 : 50)), 10);

  const result = await listPedidosForStore(supabase, store.id, {
    scope,
    status: req.query.status,
    origem: req.query.origem,
    mesa: req.query.mesa,
    limit,
  });

  if (!result.ok) {
    if (result.error?.includes('pedidos_loja')) {
      return res.status(503).json({
        error: 'Tabela pedidos_loja ausente. Aplique a migração 20260523120000 no Supabase.',
      });
    }
    return res.status(500).json({ error: result.error });
  }

  const { pedidos, itensByPedido } = result;
    const active = (pedidos || []).filter((p) =>
      [
        'pendente',
        'preparando',
        'pronto',
        'pending',
        'accepted',
        'preparing',
        'ready_for_pickup',
        'out_for_delivery',
      ].includes(p.status)
    ).length;

  return res.status(200).json({
    orders: (pedidos || []).map((p) => mapPedidoRowToApi(p, itensByPedido.get(p.id))),
    active_count: active,
    loja_id: store.id,
    scope,
  });
}

import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { mapPedidoRowToApi } from '../../../../lib/merchant/pedidos/mapPedidoRow';

/**
 * GET /api/merchant/pedidos — pedidos da loja (tenant).
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { supabase, store } = auth;
  const statusFilter = String(req.query.status || '').trim();
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 50), 10) || 50));

  let q = supabase
    .from('pedidos_loja')
    .select('*')
    .eq('loja_id', store.id)
    .eq('payment_status', 'paid')
    .order('criado_em', { ascending: false })
    .limit(limit);

  if (statusFilter) {
    q = q.eq('status', statusFilter);
  }

  const { data: pedidos, error } = await q;

  if (error) {
    if (error.message?.includes('pedidos_loja')) {
      return res.status(503).json({
        error: 'Tabela pedidos_loja ausente. Aplique a migração 20260523120000 no Supabase.',
      });
    }
    return res.status(500).json({ error: error.message });
  }

  const ids = (pedidos || []).map((p) => p.id);
  let itensByPedido = new Map();
  if (ids.length > 0) {
    const { data: itens, error: itensErr } = await supabase
      .from('pedidos_loja_itens')
      .select('id, pedido_id, produto_loja_id, nome, preco_unitario, quantidade')
      .in('pedido_id', ids);
    if (itensErr) {
      return res.status(500).json({ error: itensErr.message });
    }
    for (const row of itens || []) {
      const list = itensByPedido.get(row.pedido_id) || [];
      list.push(row);
      itensByPedido.set(row.pedido_id, list);
    }
  }

  const active = (pedidos || []).filter((p) =>
    ['pendente', 'preparando', 'pronto'].includes(p.status)
  ).length;

  return res.status(200).json({
    orders: (pedidos || []).map((p) => mapPedidoRowToApi(p, itensByPedido.get(p.id))),
    active_count: active,
    loja_id: store.id,
  });
}

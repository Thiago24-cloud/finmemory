/** GET /api/parceiros/pedir/status?pedido=uuid&loja=uuid — acompanha pedido da mesa. */
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { mapPedidoRowToApi } from '../../../../lib/merchant/pedidos/mapPedidoRow';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pedidoId = String(req.query.pedido || '').trim();
  const lojaId = String(req.query.loja || '').trim();

  if (!pedidoId || !lojaId) {
    return res.status(400).json({ error: 'Parâmetros pedido e loja obrigatórios.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Serviço indisponível' });
  }

  const { data: pedido, error } = await supabase
    .from('pedidos_loja')
    .select('*')
    .eq('id', pedidoId)
    .eq('loja_id', lojaId)
    .eq('origem', 'mesa')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado.' });

  const { data: itens } = await supabase
    .from('pedidos_loja_itens')
    .select('id, pedido_id, produto_loja_id, nome, preco_unitario, quantidade')
    .eq('pedido_id', pedidoId);

  return res.status(200).json({
    order: mapPedidoRowToApi(pedido, itens || []),
  });
}

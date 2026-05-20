import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { mapPedidoRowToApi } from '../../../../lib/merchant/pedidos/mapPedidoRow';

/**
 * GET /api/parceiros/pedidos/[id] — acompanhar pedido (cliente ou lojista da loja).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pedidoId = String(req.query.id || '').trim();
  if (!pedidoId) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ error: 'Faça login para ver o pedido.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const { data: pedido, error } = await supabase
    .from('pedidos_loja')
    .select('*')
    .eq('id', pedidoId)
    .maybeSingle();

  if (error) {
    if (error.message?.includes('pedidos_loja')) {
      return res.status(503).json({ error: 'Migração pedidos_loja pendente.' });
    }
    return res.status(500).json({ error: error.message });
  }
  if (!pedido) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }

  const { data: ul } = await supabase
    .from('usuarios_loja')
    .select('loja_id')
    .eq('id', userId)
    .maybeSingle();

  const isCliente = pedido.cliente_user_id === userId;
  const isLoja = ul?.loja_id && ul.loja_id === pedido.loja_id;
  if (!isCliente && !isLoja) {
    return res.status(403).json({ error: 'Sem permissão para ver este pedido.' });
  }

  const { data: itens } = await supabase
    .from('pedidos_loja_itens')
    .select('id, pedido_id, produto_loja_id, nome, preco_unitario, quantidade')
    .eq('pedido_id', pedidoId);

  return res.status(200).json({ order: mapPedidoRowToApi(pedido, itens || []) });
}

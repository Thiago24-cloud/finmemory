/**
 * Lista pedidos da loja com filtros por escopo operacional.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} lojaId
 * @param {{ scope?: string, status?: string, origem?: string, mesa?: string, limit?: number }} opts
 */
export async function listPedidosForStore(supabase, lojaId, opts = {}) {
  const scope = String(opts.scope || 'default').trim();
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
  const statusFilter = String(opts.status || '').trim();
  const origemFilter = String(opts.origem || '').trim();
  const mesaFilter = String(opts.mesa || '').trim();

  let q = supabase.from('pedidos_loja').select('*').eq('loja_id', lojaId);

  switch (scope) {
    case 'cozinha':
      q = q.in('status', [
        'pendente',
        'preparando',
        'pronto',
        'pending',
        'accepted',
        'preparing',
        'ready_for_pickup',
        'out_for_delivery',
      ]);
      break;
    case 'diretos':
      q = q.or('order_source.not.is.null,origem.eq.qr_public');
      break;
    case 'garcom':
      q = q
        .in('status', ['pronto', 'ready_for_pickup'])
        .in('origem', ['mesa', 'garcom', 'balcao']);
      break;
    case 'caixa':
      q = q
        .eq('payment_status', 'pending')
        .in('origem', ['mesa', 'garcom', 'balcao'])
        .neq('status', 'cancelado')
        .neq('status', 'canceled');
      break;
    case 'entrega':
      q = q.or('origem.eq.delivery,order_type.eq.delivery');
      break;
    case 'historico':
      break;
    default:
      q = q.eq('payment_status', 'paid');
      break;
  }

  if (statusFilter) q = q.eq('status', statusFilter);
  if (origemFilter) q = q.eq('origem', origemFilter);
  if (mesaFilter) {
    const mesaNum = parseInt(mesaFilter, 10);
    if (Number.isFinite(mesaNum)) q = q.eq('mesa_numero', mesaNum);
  }

  q = q.order('criado_em', { ascending: false }).limit(limit);

  const { data: pedidos, error } = await q;
  if (error) return { ok: false, error: error.message };

  const ids = (pedidos || []).map((p) => p.id);
  const itensByPedido = new Map();
  if (ids.length > 0) {
    const { data: itens, error: itensErr } = await supabase
      .from('pedidos_loja_itens')
      .select('id, pedido_id, produto_loja_id, nome, preco_unitario, quantidade, total_price')
      .in('pedido_id', ids);
    if (itensErr) {
      const { data: itens2, error: err2 } = await supabase
        .from('pedidos_loja_itens')
        .select('id, pedido_id, produto_loja_id, nome, preco_unitario, quantidade')
        .in('pedido_id', ids);
      if (err2) return { ok: false, error: err2.message };
      for (const row of itens2 || []) {
        const list = itensByPedido.get(row.pedido_id) || [];
        list.push(row);
        itensByPedido.set(row.pedido_id, list);
      }
    } else {
      for (const row of itens || []) {
        const list = itensByPedido.get(row.pedido_id) || [];
        list.push(row);
        itensByPedido.set(row.pedido_id, list);
      }
    }
  }

  return { ok: true, pedidos: pedidos || [], itensByPedido };
}

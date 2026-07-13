import { canTransitionPedidoStatus } from './pedidoStatus';

/**
 * Cancela ou estorna pedido e restaura estoque de produtos_loja.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ pedidoId: string, lojaId: string, mode?: 'cancel' | 'refund' }} input
 */
export async function cancelPedidoWithRestore(supabase, input) {
  const { pedidoId, lojaId, mode = 'cancel' } = input;
  const paymentStatus = mode === 'refund' ? 'refunded' : 'cancelled';

  const { data: existing, error: fetchErr } = await supabase
    .from('pedidos_loja')
    .select('*')
    .eq('id', pedidoId)
    .eq('loja_id', lojaId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: 'Pedido não encontrado.' };
  if (existing.status === 'cancelado') {
    return { ok: false, error: 'Pedido já cancelado.' };
  }
  if (!canTransitionPedidoStatus(existing.status, 'cancelado')) {
    return { ok: false, error: `Não é possível cancelar pedido "${existing.status}".` };
  }

  const { data: itens } = await supabase
    .from('pedidos_loja_itens')
    .select('produto_loja_id, quantidade')
    .eq('pedido_id', pedidoId);

  const nowIso = new Date().toISOString();

  for (const li of itens || []) {
    if (!li.produto_loja_id) continue;
    const { data: prod } = await supabase
      .from('produtos_loja')
      .select('quantidade_estoque')
      .eq('id', li.produto_loja_id)
      .maybeSingle();
    if (prod?.quantidade_estoque != null) {
      await supabase
        .from('produtos_loja')
        .update({
          quantidade_estoque: prod.quantidade_estoque + Number(li.quantidade || 1),
          updated_at: nowIso,
        })
        .eq('id', li.produto_loja_id);
    }
  }

  const { data: updated, error: updErr } = await supabase
    .from('pedidos_loja')
    .update({
      status: 'cancelado',
      payment_status: paymentStatus,
      updated_at: nowIso,
    })
    .eq('id', pedidoId)
    .eq('loja_id', lojaId)
    .select('*')
    .single();

  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true, pedido: updated };
}

/**
 * Caixa: confirma pagamento de pedidos da mesa e libera mesa.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ lojaId: string, pedidoIds: string[], mesaId?: string | null }} input
 */
export async function confirmMesaPayment(supabase, input) {
  const { lojaId, pedidoIds, mesaId } = input;
  if (!lojaId || !Array.isArray(pedidoIds) || pedidoIds.length === 0) {
    return { ok: false, error: 'Pedidos obrigatórios.' };
  }

  const nowIso = new Date().toISOString();

  const { data: pedidos, error: fetchErr } = await supabase
    .from('pedidos_loja')
    .select('id, mesa_id, mesa_numero, status, payment_status')
    .eq('loja_id', lojaId)
    .in('id', pedidoIds);

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!pedidos?.length) return { ok: false, error: 'Pedidos não encontrados.' };

  const invalid = pedidos.find((p) => p.payment_status === 'paid');
  if (invalid) {
    return { ok: false, error: 'Um ou mais pedidos já foram pagos.' };
  }

  const { error: updErr } = await supabase
    .from('pedidos_loja')
    .update({ payment_status: 'paid', updated_at: nowIso })
    .eq('loja_id', lojaId)
    .in('id', pedidoIds);

  if (updErr) return { ok: false, error: updErr.message };

  const resolvedMesaId = mesaId || pedidos[0]?.mesa_id;
  if (resolvedMesaId) {
    const { data: pendingOnMesa } = await supabase
      .from('pedidos_loja')
      .select('id')
      .eq('loja_id', lojaId)
      .eq('mesa_id', resolvedMesaId)
      .eq('payment_status', 'pending')
      .neq('status', 'cancelado')
      .limit(1);

    if (!pendingOnMesa?.length) {
      await supabase
        .from('mesas_loja')
        .update({ status: 'livre', updated_at: nowIso })
        .eq('id', resolvedMesaId)
        .eq('loja_id', lojaId);
    }
  }

  return { ok: true, paid_count: pedidos.length };
}

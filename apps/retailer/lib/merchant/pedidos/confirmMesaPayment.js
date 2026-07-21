const FORMAS_PAGAMENTO = new Set(['debito', 'credito', 'pix', 'dinheiro']);

function normalizeFormaPagamento(raw) {
  const m = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (m === 'credito' || m === 'credit' || m === 'credito_cartao') return 'credito';
  if (m === 'debito' || m === 'debit' || m === 'debito_cartao') return 'debito';
  if (m === 'pix') return 'pix';
  if (m === 'dinheiro' || m === 'cash') return 'dinheiro';
  return FORMAS_PAGAMENTO.has(m) ? m : null;
}

/**
 * Caixa: confirma pagamento de pedidos da mesa e libera mesa.
 * Cobrança na maquininha física fica fora do app — aqui só registra a forma e fecha.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ lojaId: string, pedidoIds: string[], mesaId?: string | null, formaPagamento?: string | null }} input
 */
export async function confirmMesaPayment(supabase, input) {
  const { lojaId, pedidoIds, mesaId } = input;
  if (!lojaId || !Array.isArray(pedidoIds) || pedidoIds.length === 0) {
    return { ok: false, error: 'Pedidos obrigatórios.' };
  }

  const formaPagamento = normalizeFormaPagamento(
    input.formaPagamento || input.forma_pagamento || input.metodo
  );
  if (!formaPagamento) {
    return {
      ok: false,
      error: 'Informe como o cliente pagou: debito, credito, pix ou dinheiro.',
    };
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
    .update({
      payment_status: 'paid',
      forma_pagamento: formaPagamento,
      updated_at: nowIso,
    })
    .eq('loja_id', lojaId)
    .in('id', pedidoIds);

  if (updErr) {
    // Migration ainda não aplicada: fecha o pedido sem gravar a forma.
    if (/forma_pagamento/i.test(updErr.message || '')) {
      const { error: fallbackErr } = await supabase
        .from('pedidos_loja')
        .update({ payment_status: 'paid', updated_at: nowIso })
        .eq('loja_id', lojaId)
        .in('id', pedidoIds);
      if (fallbackErr) return { ok: false, error: fallbackErr.message };
    } else {
      return { ok: false, error: updErr.message };
    }
  }

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

  return { ok: true, paid_count: pedidos.length, forma_pagamento: formaPagamento };
}

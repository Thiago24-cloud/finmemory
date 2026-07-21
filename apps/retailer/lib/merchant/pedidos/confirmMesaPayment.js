const FORMAS_PAGAMENTO = new Set(['debito', 'credito', 'pix', 'dinheiro', 'misto']);

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
  if (m === 'misto' || m === 'mixed') return 'misto';
  return FORMAS_PAGAMENTO.has(m) ? m : null;
}

function normalizePagamentosList(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const list = [];
  for (const row of raw) {
    const forma = normalizeFormaPagamento(row?.forma || row?.forma_pagamento || row?.metodo);
    const valor = Number(row?.valor);
    if (!forma || forma === 'misto' || !Number.isFinite(valor) || valor <= 0) continue;
    list.push({
      valor: Math.round(valor * 100) / 100,
      forma,
      at: row?.at || row?.created_at || null,
    });
  }
  return list.length ? list : null;
}

function dominantFromList(list) {
  if (!list?.length) return null;
  const forms = new Set(list.map((p) => p.forma));
  if (forms.size === 1) return list[0].forma;
  return 'misto';
}

/**
 * Caixa: confirma pagamento de pedidos da mesa e libera mesa.
 * Cobrança na maquininha física fica fora do app — aqui só registra a forma e fecha.
 * Aceita um único meio ou lista de pagamentos parciais (divisão de conta).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ lojaId: string, pedidoIds: string[], mesaId?: string | null, formaPagamento?: string | null, pagamentos?: unknown[] }} input
 */
export async function confirmMesaPayment(supabase, input) {
  const { lojaId, pedidoIds, mesaId } = input;
  if (!lojaId || !Array.isArray(pedidoIds) || pedidoIds.length === 0) {
    return { ok: false, error: 'Pedidos obrigatórios.' };
  }

  const pagamentos = normalizePagamentosList(input.pagamentos);
  let formaPagamento = normalizeFormaPagamento(
    input.formaPagamento || input.forma_pagamento || input.metodo
  );
  if (pagamentos?.length) {
    formaPagamento = dominantFromList(pagamentos);
  }
  if (!formaPagamento) {
    return {
      ok: false,
      error: 'Informe como o cliente pagou: debito, credito, pix, dinheiro (ou lista de pagamentos).',
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

  const updatePayload = {
    payment_status: 'paid',
    forma_pagamento: formaPagamento,
    updated_at: nowIso,
  };
  if (pagamentos) {
    updatePayload.pagamentos_json = pagamentos;
  }

  const { error: updErr } = await supabase
    .from('pedidos_loja')
    .update(updatePayload)
    .eq('loja_id', lojaId)
    .in('id', pedidoIds);

  if (updErr) {
    // Migration ainda não aplicada: fecha o pedido sem colunas novas.
    if (/forma_pagamento|pagamentos_json/i.test(updErr.message || '')) {
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

  return {
    ok: true,
    paid_count: pedidos.length,
    forma_pagamento: formaPagamento,
    pagamentos: pagamentos || null,
  };
}

import { notifyClientePedidoStatus, notifyMerchantNewOrder } from '../../push/merchantOrderPush';
import { computeEtaPrevistoEm } from './computePedidoEta';
import { PEDIDO_STATUS } from './pedidoStatus';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   lojaId: string,
 *   clienteUserId: string,
 *   items: Array<{ produto_loja_id: string, quantidade?: number }>,
 *   observacao?: string | null,
 *   paymentStatus?: 'pending' | 'paid',
 *   skipStockDecrement?: boolean,
 *   skipMerchantPush?: boolean,
 * }} input
 */
export async function createPedidoLoja(supabase, input) {
  const {
    lojaId,
    clienteUserId,
    items,
    observacao,
    paymentStatus = 'paid',
    skipStockDecrement = false,
    skipMerchantPush = false,
  } = input;
  if (!lojaId || !clienteUserId || !Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Informe a loja e pelo menos um item.' };
  }

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, name, tempo_preparo_medio, active, needs_review')
    .eq('id', lojaId)
    .maybeSingle();

  if (storeErr) return { ok: false, error: storeErr.message };
  if (!store?.id) return { ok: false, error: 'Loja não encontrada.' };
  if (store.active === false) return { ok: false, error: 'Loja indisponível no momento.' };
  if (store.needs_review === true) {
    return { ok: false, error: 'Loja ainda em análise. Tente novamente em breve.' };
  }

  const tempoPrep = Math.max(5, Math.min(120, Number(store.tempo_preparo_medio) || 15));
  const productIds = [
    ...new Set(
      items
        .map((i) => String(i.produto_loja_id || '').trim())
        .filter(Boolean)
    ),
  ];

  const { data: produtos, error: prodErr } = await supabase
    .from('produtos_loja')
    .select('id, loja_id, nome, preco_oferta, status_disponivel, em_oferta, quantidade_estoque')
    .eq('loja_id', lojaId)
    .in('id', productIds);

  if (prodErr) {
    if (prodErr.message?.includes('produtos_loja')) {
      return { ok: false, error: 'Catálogo da loja indisponível. Aplique a migração multitenancy.' };
    }
    return { ok: false, error: prodErr.message };
  }

  const byId = new Map((produtos || []).map((p) => [p.id, p]));
  const lineItems = [];
  let total = 0;

  for (const raw of items) {
    const pid = String(raw.produto_loja_id || '').trim();
    const qty = Math.max(1, Math.min(99, parseInt(String(raw.quantidade ?? 1), 10) || 1));
    const p = byId.get(pid);
    if (!p) return { ok: false, error: 'Produto inválido ou de outra loja.' };
    if (!p.status_disponivel || !p.em_oferta) {
      return { ok: false, error: `Produto indisponível: ${p.nome}` };
    }
    if (p.quantidade_estoque != null && p.quantidade_estoque < qty) {
      return { ok: false, error: `Estoque insuficiente: ${p.nome}` };
    }
    const preco = Number(p.preco_oferta);
    lineItems.push({
      produto_loja_id: p.id,
      nome: p.nome,
      preco_unitario: preco,
      quantidade: qty,
    });
    total += preco * qty;
  }

  const nowIso = new Date().toISOString();
  const etaPrevisto = computeEtaPrevistoEm(tempoPrep);

  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos_loja')
    .insert({
      loja_id: lojaId,
      cliente_user_id: clienteUserId,
      status: PEDIDO_STATUS.PENDENTE,
      total: Math.round(total * 100) / 100,
      observacao: observacao ? String(observacao).slice(0, 500) : null,
      tempo_preparo_minutos: tempoPrep,
      eta_previsto_em: etaPrevisto,
      payment_status: paymentStatus,
      updated_at: nowIso,
    })
    .select('*')
    .single();

  if (pedidoErr) {
    if (pedidoErr.message?.includes('pedidos_loja')) {
      return { ok: false, error: 'Tabela pedidos_loja ausente. Aplique a migração 20260523120000.' };
    }
    return { ok: false, error: pedidoErr.message };
  }

  const itensPayload = lineItems.map((li) => ({
    pedido_id: pedido.id,
    produto_loja_id: li.produto_loja_id,
    nome: li.nome,
    preco_unitario: li.preco_unitario,
    quantidade: li.quantidade,
  }));

  const { error: itensErr } = await supabase.from('pedidos_loja_itens').insert(itensPayload);
  if (itensErr) {
    await supabase.from('pedidos_loja').delete().eq('id', pedido.id);
    return { ok: false, error: itensErr.message };
  }

  if (!skipStockDecrement) {
    for (const li of lineItems) {
      const p = byId.get(li.produto_loja_id);
      if (p?.quantidade_estoque != null) {
        await supabase
          .from('produtos_loja')
          .update({
            quantidade_estoque: p.quantidade_estoque - li.quantidade,
            updated_at: nowIso,
          })
          .eq('id', li.produto_loja_id);
      }
    }
  }

  if (skipMerchantPush) {
    return {
      ok: true,
      pedido,
      itens: itensPayload,
      store_name: store.name,
      produtosById: byId,
    };
  }

  void notifyMerchantNewOrder(supabase, {
    pedido,
    storeName: store.name,
    lojaId,
  }).catch((err) => {
    console.warn('[createPedidoLoja] push lojista:', err?.message || err);
  });

  return {
    ok: true,
    pedido,
    itens: itensPayload,
    store_name: store.name,
  };
}

import { notifyMerchantNewOrder } from '../../push/merchantOrderPush';
import { computeEtaPrevistoEm } from './computePedidoEta';
import { PEDIDO_STATUS } from './pedidoStatus';
import { resolveMesaGuestUserId } from './resolveMesaGuestUserId';

function resolveMenuPrice(produto) {
  const oferta = Number(produto.preco_oferta);
  if (produto.em_oferta && Number.isFinite(oferta) && oferta > 0) return oferta;
  const original = Number(produto.preco_original);
  if (Number.isFinite(original) && original > 0) return original;
  return oferta > 0 ? oferta : 0;
}

/**
 * Pedido via QR da mesa (sem login do cliente).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   lojaId: string,
 *   mesaNumero: number,
 *   items: Array<{ produto_loja_id: string, quantidade?: number }>,
 *   observacao?: string | null,
 * }} input
 */
export async function createPedidoMesa(supabase, input) {
  const { lojaId, mesaNumero, items, observacao } = input;

  if (!lojaId || !Number.isFinite(mesaNumero) || mesaNumero < 0) {
    return { ok: false, error: 'Loja ou mesa inválida.' };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Adicione pelo menos um item.' };
  }

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, name, tempo_preparo_medio, active, needs_review')
    .eq('id', lojaId)
    .maybeSingle();

  if (storeErr) return { ok: false, error: storeErr.message };
  if (!store?.id) return { ok: false, error: 'Loja não encontrada.' };
  if (store.active === false) return { ok: false, error: 'Restaurante fechado no momento.' };
  if (store.needs_review === true) {
    return { ok: false, error: 'Restaurante em análise. Tente novamente em breve.' };
  }

  const { data: mesa, error: mesaErr } = await supabase
    .from('mesas_loja')
    .select('id, numero, status')
    .eq('loja_id', lojaId)
    .eq('numero', mesaNumero)
    .maybeSingle();

  if (mesaErr) {
    if (/mesas_loja/i.test(mesaErr.message || '')) {
      return { ok: false, error: 'Mesas não configuradas. Rode a migração de mesas no Supabase.' };
    }
    return { ok: false, error: mesaErr.message };
  }
  if (!mesa?.id) {
    return { ok: false, error: `Mesa ${mesaNumero} não encontrada.` };
  }
  if (mesa.status === 'fechada') {
    return { ok: false, error: 'Esta mesa está fechada.' };
  }

  const productIds = [
    ...new Set(items.map((i) => String(i.produto_loja_id || '').trim()).filter(Boolean)),
  ];

  const { data: produtos, error: prodErr } = await supabase
    .from('produtos_loja')
    .select('id, loja_id, nome, preco_original, preco_oferta, em_oferta, status_disponivel, quantidade_estoque')
    .eq('loja_id', lojaId)
    .in('id', productIds);

  if (prodErr) return { ok: false, error: prodErr.message };

  const byId = new Map((produtos || []).map((p) => [p.id, p]));
  const lineItems = [];
  let total = 0;

  for (const raw of items) {
    const pid = String(raw.produto_loja_id || '').trim();
    const qty = Math.max(1, Math.min(20, parseInt(String(raw.quantidade ?? 1), 10) || 1));
    const p = byId.get(pid);
    if (!p) return { ok: false, error: 'Item inválido no cardápio.' };
    if (!p.status_disponivel) {
      return { ok: false, error: `Indisponível: ${p.nome}` };
    }
    const preco = resolveMenuPrice(p);
    if (!Number.isFinite(preco) || preco <= 0) {
      return { ok: false, error: `Preço não configurado: ${p.nome}` };
    }
    if (p.quantidade_estoque != null && p.quantidade_estoque < qty) {
      return { ok: false, error: `Esgotado: ${p.nome}` };
    }
    lineItems.push({
      produto_loja_id: p.id,
      nome: p.nome,
      preco_unitario: preco,
      quantidade: qty,
    });
    total += preco * qty;
  }

  let clienteUserId;
  try {
    clienteUserId = await resolveMesaGuestUserId(supabase);
  } catch (err) {
    return { ok: false, error: err.message || 'Erro ao registrar pedido.' };
  }

  const tempoPrep = Math.max(5, Math.min(120, Number(store.tempo_preparo_medio) || 15));
  const nowIso = new Date().toISOString();
  const etaPrevisto = computeEtaPrevistoEm(tempoPrep);

  const obsParts = [];
  if (observacao?.trim()) obsParts.push(String(observacao).trim());
  obsParts.push(`Mesa ${mesaNumero}`);

  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos_loja')
    .insert({
      loja_id: lojaId,
      cliente_user_id: clienteUserId,
      status: PEDIDO_STATUS.PENDENTE,
      total: Math.round(total * 100) / 100,
      observacao: obsParts.join(' · ').slice(0, 500),
      tempo_preparo_minutos: tempoPrep,
      eta_previsto_em: etaPrevisto,
      payment_status: 'pending',
      mesa_id: mesa.id,
      mesa_numero: mesaNumero,
      origem: 'mesa',
      updated_at: nowIso,
    })
    .select('*')
    .single();

  if (pedidoErr) {
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

  await supabase
    .from('mesas_loja')
    .update({ status: 'ocupada', updated_at: nowIso })
    .eq('id', mesa.id);

  void notifyMerchantNewOrder(supabase, {
    pedido,
    storeName: store.name,
    lojaId,
  }).catch(() => {});

  return {
    ok: true,
    pedido,
    itens: itensPayload,
    store_name: store.name,
    mesa_numero: mesaNumero,
  };
}

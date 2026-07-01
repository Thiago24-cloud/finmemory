const TERMINALS = new Set(['stone', 'cielo', 'pagseguro', 'mercadopago', 'rede', 'other']);
const METODOS = new Set(['credito', 'debito', 'pix', 'dinheiro']);
const STATUSES = new Set(['aprovado', 'rejeitado', 'cancelado']);

function normalizeTerminal(v) {
  const t = String(v || 'other').toLowerCase();
  return TERMINALS.has(t) ? t : 'other';
}

function normalizeMetodo(v) {
  const m = String(v || 'credito').toLowerCase();
  return METODOS.has(m) ? m : 'credito';
}

function normalizeStatus(v) {
  const s = String(v || 'aprovado').toLowerCase();
  return STATUSES.has(s) ? s : 'aprovado';
}

/**
 * Valida e normaliza itens do webhook (produto_loja_id = uuid).
 * @param {unknown[]} rawItems
 */
export function normalizeWebhookItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: 'items deve ser um array com pelo menos 1 item' };
  }

  const items = [];
  for (const raw of rawItems) {
    const produtoId = raw?.produto_loja_id || raw?.produto_id;
    const quantidade = Number(raw?.quantidade);
    const preco = Number(raw?.preco_unitario);
    if (!produtoId || !Number.isFinite(quantidade) || quantidade <= 0) {
      return { error: 'Cada item precisa de produto_loja_id e quantidade > 0' };
    }
    if (!Number.isFinite(preco) || preco <= 0) {
      return { error: 'Cada item precisa de preco_unitario > 0' };
    }
    items.push({
      produto_loja_id: String(produtoId),
      quantidade: Math.floor(quantidade),
      preco_unitario: preco,
      subtotal: Math.floor(quantidade) * preco,
    });
  }
  return { items };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} params
 */
export async function processTerminalPayment(supabase, params) {
  const {
    lojaId,
    externalRef,
    idempotencyKey,
    terminal,
    bandeira,
    valorTotal,
    metodo,
    status,
    rawPayload,
    vendidoEm,
    items,
  } = params;

  if (!lojaId) {
    return { ok: false, status: 400, body: { error: 'loja_id obrigatório' } };
  }

  const valor = Number(valorTotal);
  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false, status: 400, body: { error: 'valor_total inválido' } };
  }

  const normalizedStatus = normalizeStatus(status);

  // Valida produtos da loja antes de registrar
  if (normalizedStatus === 'aprovado' && items?.length) {
    const ids = [...new Set(items.map((i) => i.produto_loja_id))];
    const { data: produtos, error: prodErr } = await supabase
      .from('produtos_loja')
      .select('id, nome, loja_id')
      .in('id', ids)
      .eq('loja_id', lojaId);

    if (prodErr) {
      return { ok: false, status: 500, body: { error: 'Erro ao validar produtos' } };
    }

    const found = new Set((produtos || []).map((p) => p.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      return {
        ok: false,
        status: 422,
        body: { error: 'Produtos não encontrados na loja', missing_ids: missing },
      };
    }

    const nomeById = new Map((produtos || []).map((p) => [p.id, p.nome]));
    for (const item of items) {
      item.nome_produto = nomeById.get(item.produto_loja_id) || 'Produto';
    }
  }

  const rpcItems = (items || []).map((i) => ({
    produto_loja_id: i.produto_loja_id,
    nome_produto: i.nome_produto || 'Item',
    quantidade: i.quantidade,
    preco_unitario: i.preco_unitario,
    subtotal: i.subtotal ?? i.quantidade * i.preco_unitario,
  }));

  const { data, error } = await supabase.rpc('registrar_venda_terminal', {
    p_loja_id: lojaId,
    p_external_ref: externalRef || null,
    p_idempotency_key: idempotencyKey || null,
    p_terminal: normalizeTerminal(terminal),
    p_bandeira: bandeira || null,
    p_valor_total: valor,
    p_metodo: normalizeMetodo(metodo),
    p_status: normalizedStatus,
    p_raw_payload: rawPayload ?? null,
    p_vendido_em: vendidoEm ? new Date(vendidoEm).toISOString() : null,
    p_itens: rpcItems,
  });

  if (error) {
    console.error('[processTerminalPayment]', error);
    return { ok: false, status: 500, body: { error: 'Erro ao registrar venda' } };
  }

  const result = data || {};
  return {
    ok: true,
    status: result.duplicate ? 200 : 201,
    body: {
      ok: true,
      duplicate: Boolean(result.duplicate),
      venda_id: result.venda_id,
      stock_updated: Boolean(result.stock_updated),
    },
  };
}

/**
 * Converte payload do app Android (SalePostRequest) para processTerminalPayment.
 */
export function androidSaleToPaymentParams(storeId, body) {
  const lojaId = body?.lojaId || body?.loja_id;
  if (lojaId !== storeId) {
    return { error: 'lojaId não corresponde à loja da sessão', status: 403 };
  }

  const itens = Array.isArray(body?.itens) ? body.itens : [];
  if (itens.length === 0) {
    return { error: 'itens obrigatório', status: 400 };
  }

  const items = itens.map((i) => ({
    produto_loja_id: i.produtoId || i.produto_loja_id || null,
    nome_produto: i.nome || 'Item',
    quantidade: Math.max(1, Math.round(Number(i.quantidade) || 1)),
    preco_unitario: Number(i.precoUnitarioCentavos || i.preco_unitario || 0) / 100,
  }));

  const totalCentavos = Number(body?.totalCentavos ?? body?.total_centavos ?? 0);
  const valorTotal = totalCentavos > 0 ? totalCentavos / 100 : items.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);

  const externalRef =
    body?.stoneTransactionId ||
    body?.stone_transaction_id ||
    body?.external_ref ||
    null;

  return {
    params: {
      lojaId: storeId,
      externalRef,
      idempotencyKey: body?.idempotencyKey || body?.idempotency_key || null,
      terminal: 'stone',
      bandeira: null,
      valorTotal,
      metodo: String(body?.formaPagamento || body?.forma_pagamento || 'credito').toLowerCase(),
      status: 'aprovado',
      rawPayload: {
        source: 'android',
        stone_authorization_code: body?.stoneAuthorizationCode || body?.stone_authorization_code || null,
      },
      vendidoEm: body?.vendidoEmEpochMs ? new Date(Number(body.vendidoEmEpochMs)) : new Date(),
      items: items,
    },
  };
}

import { notifyMerchantNewOrder } from '../../push/merchantOrderPush';
import { computeEtaPrevistoEm } from './computePedidoEta';
import { DIRECT_ORDER_STATUS, generatePickupCode } from './pedidoStatus';
import { normalizeWhatsappDigits } from '../storePublicQrWhatsapp';

/**
 * Baixa estoque só se inventory_control estiver no plano (hook futuro).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} storeId
 */
export async function shouldDecrementInventoryForStore(supabase, storeId) {
  try {
    const { data: sub } = await supabase
      .from('store_subscriptions')
      .select('plan_code, status, trial_ends_at')
      .eq('store_id', storeId)
      .maybeSingle();
    if (!sub) return false;
    let status = sub.status;
    if (
      status === 'trialing' &&
      sub.trial_ends_at &&
      new Date(sub.trial_ends_at).getTime() < Date.now()
    ) {
      return false;
    }
    if (status !== 'trialing' && status !== 'active') return false;
    const { data: feats } = await supabase
      .from('store_plan_features')
      .select('feature_key')
      .eq('plan_code', sub.plan_code)
      .eq('feature_key', 'inventory_control');
    return (feats || []).length > 0;
  } catch {
    return false;
  }
}

async function assertDirectOrderFeatures(supabase, storeId, orderType) {
  const gatesOff =
    process.env.STORE_FEATURE_GATES === '0' || process.env.STORE_FEATURE_GATES === 'false';
  if (gatesOff) return { ok: true };

  const { data: sub, error } = await supabase
    .from('store_subscriptions')
    .select('plan_code, status, trial_ends_at')
    .eq('store_id', storeId)
    .maybeSingle();

  if (error) {
    if (/store_subscriptions/i.test(error.message || '')) return { ok: true };
    return { ok: false, error: error.message };
  }
  if (!sub) return { ok: true };

  let status = sub.status;
  if (
    status === 'trialing' &&
    sub.trial_ends_at &&
    new Date(sub.trial_ends_at).getTime() < Date.now()
  ) {
    return { ok: false, error: 'Assinatura/trial expirado.' };
  }
  if (status !== 'trialing' && status !== 'active') {
    return { ok: false, error: 'Assinatura inativa.' };
  }

  const { data: feats } = await supabase
    .from('store_plan_features')
    .select('feature_key')
    .eq('plan_code', sub.plan_code);
  const keys = new Set((feats || []).map((f) => f.feature_key));

  if (!keys.has('direct_orders')) {
    return {
      ok: false,
      error: 'Essa funcionalidade está disponível no plano Pedidos Diretos.',
      code: 'FEATURE_LOCKED',
      feature: 'direct_orders',
    };
  }
  if (orderType === 'pickup' && !keys.has('pickup_orders')) {
    return {
      ok: false,
      error: 'Essa funcionalidade está disponível no plano Pedidos Diretos.',
      code: 'FEATURE_LOCKED',
      feature: 'pickup_orders',
    };
  }
  if (orderType === 'delivery' && !keys.has('local_delivery')) {
    return {
      ok: false,
      error: 'Essa funcionalidade está disponível no plano Pedidos Diretos.',
      code: 'FEATURE_LOCKED',
      feature: 'local_delivery',
    };
  }
  return { ok: true };
}

/**
 * Upsert restaurant_customers (perfil leve).
 */
async function upsertRestaurantCustomer(supabase, storeId, name, phoneDigits, userId) {
  if (!phoneDigits) return null;
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('restaurant_customers')
    .select('id')
    .eq('store_id', storeId)
    .eq('whatsapp_digits', phoneDigits)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from('restaurant_customers')
      .update({
        name,
        updated_at: now,
        ...(userId ? { user_id: userId } : {}),
      })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('restaurant_customers')
    .insert({
      store_id: storeId,
      name,
      whatsapp_digits: phoneDigits,
      user_id: userId || null,
      updated_at: now,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    console.warn('[createDirectOrder] restaurant_customers:', error.message);
    return null;
  }
  return created?.id || null;
}

/**
 * Pedido direto (QR / página pública) — sem pagamento online.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   restaurantId: string,
 *   consumerId?: string|null,
 *   customerName: string,
 *   customerPhone: string,
 *   orderType: 'pickup'|'delivery',
 *   items: Array<{ productId: string, quantity?: number }>,
 *   notes?: string|null,
 *   source?: 'qr_code'|'public_page'|'manual',
 * }} input
 */
export async function createDirectOrder(supabase, input) {
  const restaurantId = String(input.restaurantId || '').trim();
  const customerName = String(input.customerName || '').trim();
  const customerPhone = normalizeWhatsappDigits(input.customerPhone || '');
  const orderType = input.orderType === 'delivery' ? 'delivery' : 'pickup';
  const source = ['qr_code', 'public_page', 'manual'].includes(input.source)
    ? input.source
    : 'public_page';
  const consumerId = input.consumerId ? String(input.consumerId) : null;
  const items = Array.isArray(input.items) ? input.items : [];
  const notes = input.notes ? String(input.notes).slice(0, 500) : null;

  if (!restaurantId) return { ok: false, error: 'Loja obrigatória.' };
  if (customerName.length < 2) return { ok: false, error: 'Informe o nome.' };
  if (customerPhone.length < 12) return { ok: false, error: 'Informe um WhatsApp válido com DDD.' };
  if (items.length === 0) return { ok: false, error: 'Adicione pelo menos um item.' };

  const feat = await assertDirectOrderFeatures(supabase, restaurantId, orderType);
  if (!feat.ok) return feat;

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, name, tempo_preparo_medio, active, needs_review')
    .eq('id', restaurantId)
    .maybeSingle();

  if (storeErr) return { ok: false, error: storeErr.message };
  if (!store?.id) return { ok: false, error: 'Loja não encontrada.' };
  if (store.active === false) return { ok: false, error: 'Loja indisponível.' };
  if (store.needs_review === true) {
    return { ok: false, error: 'Loja ainda em análise.' };
  }

  const productIds = [
    ...new Set(items.map((i) => String(i.productId || i.produto_loja_id || '').trim()).filter(Boolean)),
  ];

  const { data: produtos, error: prodErr } = await supabase
    .from('produtos_loja')
    .select(
      'id, loja_id, nome, preco_oferta, preco_original, status_disponivel, em_oferta, quantidade_estoque'
    )
    .eq('loja_id', restaurantId)
    .in('id', productIds);

  if (prodErr) return { ok: false, error: prodErr.message };

  const byId = new Map((produtos || []).map((p) => [p.id, p]));
  const lineItems = [];
  let total = 0;

  for (const raw of items) {
    const pid = String(raw.productId || raw.produto_loja_id || '').trim();
    const qty = Math.max(1, Math.min(99, parseInt(String(raw.quantity ?? raw.quantidade ?? 1), 10) || 1));
    const p = byId.get(pid);
    if (!p) return { ok: false, error: 'Produto inválido ou de outra loja.' };
    if (!p.status_disponivel) {
      return { ok: false, error: `Produto indisponível: ${p.nome}` };
    }
    const oferta = Number(p.preco_oferta);
    const original = Number(p.preco_original);
    const unit =
      p.em_oferta && Number.isFinite(oferta) && oferta > 0
        ? oferta
        : Number.isFinite(original) && original > 0
          ? original
          : oferta;
    if (!Number.isFinite(unit) || unit < 0) {
      return { ok: false, error: `Preço inválido: ${p.nome}` };
    }
    const lineTotal = Math.round(unit * qty * 100) / 100;
    lineItems.push({
      produto_loja_id: p.id,
      nome: p.nome,
      preco_unitario: unit,
      quantidade: qty,
      total_price: lineTotal,
    });
    total += lineTotal;
  }

  const restaurantCustomerId = await upsertRestaurantCustomer(
    supabase,
    restaurantId,
    customerName,
    customerPhone,
    consumerId
  );

  const tempoPrep = Math.max(5, Math.min(120, Number(store.tempo_preparo_medio) || 15));
  const nowIso = new Date().toISOString();
  let pickupCode = generatePickupCode();
  for (let i = 0; i < 5; i += 1) {
    const { data: clash } = await supabase
      .from('pedidos_loja')
      .select('id')
      .eq('loja_id', restaurantId)
      .eq('pickup_code', pickupCode)
      .maybeSingle();
    if (!clash) break;
    pickupCode = generatePickupCode();
  }

  const origem = orderType === 'delivery' ? 'delivery' : 'qr_public';

  const insertRow = {
    loja_id: restaurantId,
    cliente_user_id: consumerId,
    status: DIRECT_ORDER_STATUS.PENDING,
    total: Math.round(total * 100) / 100,
    observacao: notes,
    tempo_preparo_minutos: tempoPrep,
    eta_previsto_em: computeEtaPrevistoEm(tempoPrep),
    payment_status: 'pending',
    origem,
    order_type: orderType,
    order_source: source,
    customer_name: customerName,
    customer_phone: customerPhone,
    pickup_code: pickupCode,
    restaurant_customer_id: restaurantCustomerId,
    updated_at: nowIso,
  };

  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos_loja')
    .insert(insertRow)
    .select('*')
    .single();

  if (pedidoErr) {
    if (/customer_name|pickup_code|order_type|order_source|cliente_user_id/i.test(pedidoErr.message || '')) {
      return {
        ok: false,
        error: 'Schema de pedido direto ausente. Execute 20260723140000_direct_orders_pickup.sql.',
        code: 'MISSING_SCHEMA',
      };
    }
    return { ok: false, error: pedidoErr.message };
  }

  const itensPayload = lineItems.map((li) => ({
    pedido_id: pedido.id,
    produto_loja_id: li.produto_loja_id,
    nome: li.nome,
    preco_unitario: li.preco_unitario,
    quantidade: li.quantidade,
    total_price: li.total_price,
  }));

  const { error: itensErr } = await supabase.from('pedidos_loja_itens').insert(itensPayload);
  if (itensErr) {
    await supabase.from('pedidos_loja').delete().eq('id', pedido.id);
    // retry without total_price if column missing
    if (/total_price/i.test(itensErr.message || '')) {
      const slim = itensPayload.map(({ total_price: _t, ...rest }) => rest);
      const { error: retryErr } = await supabase.from('pedidos_loja_itens').insert(slim);
      if (retryErr) {
        return { ok: false, error: retryErr.message };
      }
    } else {
      return { ok: false, error: itensErr.message };
    }
  }

  const doStock = await shouldDecrementInventoryForStore(supabase, restaurantId);
  if (doStock) {
    for (const li of lineItems) {
      const p = byId.get(li.produto_loja_id);
      if (p?.quantidade_estoque != null) {
        await supabase
          .from('produtos_loja')
          .update({
            quantidade_estoque: Math.max(0, p.quantidade_estoque - li.quantidade),
            updated_at: nowIso,
          })
          .eq('id', li.produto_loja_id);
      }
    }
  }

  try {
    await supabase.from('store_public_events').insert({
      store_id: restaurantId,
      event_type: 'order_started',
      meta: {
        pedido_id: pedido.id,
        pickup_code: pickupCode,
        order_type: orderType,
        source,
        inventory_decremented: doStock,
      },
    });
  } catch {
    /* optional */
  }

  void notifyMerchantNewOrder(supabase, {
    pedido,
    storeName: store.name,
    lojaId: restaurantId,
  }).catch((err) => {
    console.warn('[createDirectOrder] push:', err?.message || err);
  });

  return {
    ok: true,
    pedido,
    itens: itensPayload,
    store_name: store.name,
    pickup_code: pickupCode,
    inventory_decremented: doStock,
  };
}

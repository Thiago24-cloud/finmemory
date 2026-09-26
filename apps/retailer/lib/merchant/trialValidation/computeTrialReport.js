import { getRestaurantPlan } from '../storePlans';
import {
  evaluateTrialValidation,
  getTrialValidationCriteria,
} from './criteria';

function daysBetween(from, to) {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.ceil((b - a) / (24 * 60 * 60 * 1000));
}

function isCompletedStatus(status) {
  return ['delivered', 'concluido'].includes(String(status || ''));
}

function isCanceledStatus(status) {
  return ['canceled', 'cancelado'].includes(String(status || ''));
}

/** Dados de demonstração quando não há tráfego / ?mock=1 */
export function buildMockTrialMetrics() {
  return {
    qr_scans: 84,
    page_views: 126,
    customers_registered: 32,
    orders_started: 14,
    orders_completed: 11,
    conversion_scan_to_customer: 0.381,
    conversion_customer_to_order: 0.438,
    orders_pickup: 10,
    orders_delivery: 4,
    direct_revenue: 1287.5,
    avg_ticket: 91.96,
    recurring_customers: 4,
    top_products: [
      { name: 'X-Burguer', quantity: 18, revenue: 540 },
      { name: 'Refrigerante 350ml', quantity: 22, revenue: 176 },
      { name: 'Batata frita', quantity: 12, revenue: 180 },
    ],
    estimated_marketplace_savings: 257.5,
    stock_decrement_events: 9,
    estimated_margin: null,
    features_used: {
      qr_code: true,
      public_store_page: true,
      customer_registration: true,
      direct_orders: true,
      pickup_orders: true,
      local_delivery: true,
      inventory_control: true,
      reports: true,
    },
  };
}

/**
 * Calcula métricas de validação do trial para uma loja.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} storeId
 * @param {{ from?: string, to?: string, mock?: boolean }} [opts]
 */
export async function computeTrialReport(supabase, storeId, opts = {}) {
  const criteria = getTrialValidationCriteria();
  const plan = await getRestaurantPlan(supabase, storeId);
  const now = new Date();

  let periodStart =
    opts.from ||
    plan.trialStartedAt ||
    new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let periodEnd = opts.to || plan.trialEndsAt || now.toISOString();

  if (new Date(periodEnd) > now) periodEnd = now.toISOString();

  const trialDaysRemaining =
    plan.trialEndsAt != null
      ? Math.max(0, daysBetween(now.toISOString(), plan.trialEndsAt))
      : null;

  let willingToPay = null;
  let validationNotes = null;
  if (!plan.missingSchema) {
    const { data: sub } = await supabase
      .from('store_subscriptions')
      .select('willing_to_pay, validation_notes')
      .eq('store_id', storeId)
      .maybeSingle();
    if (sub) {
      willingToPay = sub.willing_to_pay;
      validationNotes = sub.validation_notes || null;
    }
  }

  if (opts.mock) {
    const metrics = buildMockTrialMetrics();
    const evaluation = evaluateTrialValidation(metrics, criteria, {
      willingToPay: willingToPay ?? true,
    });
    return {
      store_id: storeId,
      period: { from: periodStart, to: periodEnd },
      trial: {
        status: plan.status,
        plan_code: plan.planCode,
        plan_name: plan.planName,
        trial_started_at: plan.trialStartedAt,
        trial_ends_at: plan.trialEndsAt,
        days_remaining: trialDaysRemaining,
        willing_to_pay: willingToPay ?? true,
        validation_notes: validationNotes,
      },
      criteria,
      metrics,
      evaluation,
      mock: true,
    };
  }

  const metrics = {
    qr_scans: 0,
    page_views: 0,
    customers_registered: 0,
    orders_started: 0,
    orders_completed: 0,
    conversion_scan_to_customer: 0,
    conversion_customer_to_order: 0,
    orders_pickup: 0,
    orders_delivery: 0,
    direct_revenue: 0,
    avg_ticket: 0,
    recurring_customers: 0,
    top_products: [],
    estimated_marketplace_savings: 0,
    stock_decrement_events: 0,
    estimated_margin: null,
    features_used: {
      qr_code: false,
      public_store_page: false,
      customer_registration: false,
      direct_orders: false,
      pickup_orders: false,
      local_delivery: false,
      inventory_control: false,
      reports: true,
    },
  };

  // Eventos públicos
  const { data: events, error: evErr } = await supabase
    .from('store_public_events')
    .select('event_type, meta, created_at')
    .eq('store_id', storeId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  if (!evErr && events) {
    for (const e of events) {
      if (e.event_type === 'qr_code_scanned') metrics.qr_scans += 1;
      if (e.event_type === 'public_page_viewed') metrics.page_views += 1;
      if (e.event_type === 'customer_registered') metrics.customers_registered += 1;
      if (e.event_type === 'order_started') metrics.orders_started += 1;
      if (e.event_type === 'qr_code_scanned') metrics.features_used.qr_code = true;
      if (e.event_type === 'public_page_viewed') metrics.features_used.public_store_page = true;
      if (e.event_type === 'customer_registered') {
        metrics.features_used.customer_registration = true;
      }
      if (e.event_type === 'order_started') {
        metrics.features_used.direct_orders = true;
        if (e.meta?.inventory_decremented) metrics.stock_decrement_events += 1;
      }
    }
  } else {
    // Fallback clientes pela tabela
    const { count } = await supabase
      .from('restaurant_customers')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);
    if (typeof count === 'number') metrics.customers_registered = count;
  }

  // Se eventos de cadastro vazios, usar tabela
  if (metrics.customers_registered === 0) {
    const { count } = await supabase
      .from('restaurant_customers')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);
    if (typeof count === 'number' && count > 0) {
      metrics.customers_registered = count;
      metrics.features_used.customer_registration = true;
    }
  }

  // Pedidos diretos
  let pedidosQuery = supabase
    .from('pedidos_loja')
    .select(
      'id, status, total, order_type, order_source, origem, customer_phone, restaurant_customer_id, criado_em'
    )
    .eq('loja_id', storeId)
    .gte('criado_em', periodStart)
    .lte('criado_em', periodEnd);

  const { data: pedidos, error: pedErr } = await pedidosQuery;

  const directPedidos = (pedidos || []).filter((p) => {
    if (pedErr) return false;
    return (
      p.order_source != null ||
      p.origem === 'qr_public' ||
      p.origem === 'delivery' ||
      p.order_type === 'pickup' ||
      p.order_type === 'delivery'
    );
  });

  // Preferir pedidos com order_source; se vazio, usar filtro amplo só se houver QR events
  const usePedidos =
    directPedidos.filter((p) => p.order_source || p.origem === 'qr_public').length > 0
      ? directPedidos.filter((p) => p.order_source || p.origem === 'qr_public')
      : directPedidos.filter((p) => !p.mesa_numero && p.origem !== 'mesa' && p.origem !== 'garcom');

  if (!pedErr) {
    if (metrics.orders_started === 0) {
      metrics.orders_started = usePedidos.length;
    }
    let revenue = 0;
    let completed = 0;
    const byPhone = new Map();
    const productAgg = new Map();

    for (const p of usePedidos) {
      if (isCanceledStatus(p.status)) continue;
      if (p.order_type === 'delivery' || p.origem === 'delivery') {
        metrics.orders_delivery += 1;
        metrics.features_used.local_delivery = true;
      } else {
        metrics.orders_pickup += 1;
        metrics.features_used.pickup_orders = true;
      }
      if (isCompletedStatus(p.status)) {
        completed += 1;
        revenue += Number(p.total) || 0;
      }
      const key = p.restaurant_customer_id || p.customer_phone || p.id;
      byPhone.set(key, (byPhone.get(key) || 0) + 1);
      metrics.features_used.direct_orders = true;
    }

    metrics.orders_completed = completed;
    metrics.direct_revenue = Math.round(revenue * 100) / 100;
    metrics.avg_ticket =
      completed > 0 ? Math.round((revenue / completed) * 100) / 100 : 0;
    metrics.recurring_customers = [...byPhone.values()].filter((n) => n >= 2).length;
    metrics.estimated_marketplace_savings =
      Math.round(revenue * Number(criteria.marketplace_fee_rate || 0) * 100) / 100;

    // Top produtos
    const pedidoIds = usePedidos.map((p) => p.id);
    if (pedidoIds.length > 0) {
      const { data: itens } = await supabase
        .from('pedidos_loja_itens')
        .select('nome, quantidade, preco_unitario, total_price, pedido_id')
        .in('pedido_id', pedidoIds.slice(0, 200));
      for (const it of itens || []) {
        const name = it.nome || 'Item';
        const qty = Number(it.quantidade) || 0;
        const rev =
          it.total_price != null
            ? Number(it.total_price)
            : qty * Number(it.preco_unitario || 0);
        const cur = productAgg.get(name) || { name, quantity: 0, revenue: 0 };
        cur.quantity += qty;
        cur.revenue += rev;
        productAgg.set(name, cur);
      }
      metrics.top_products = [...productAgg.values()]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 8)
        .map((p) => ({
          name: p.name,
          quantity: p.quantity,
          revenue: Math.round(p.revenue * 100) / 100,
        }));
    }

    if (metrics.stock_decrement_events > 0) {
      metrics.features_used.inventory_control = true;
    }

    // Margem estimada se houver custo médio nos insumos ligados — best-effort null
    if (criteria.default_margin_rate != null && revenue > 0) {
      metrics.estimated_margin =
        Math.round(revenue * Number(criteria.default_margin_rate) * 100) / 100;
    }
  }

  const scansBase = metrics.qr_scans || metrics.page_views || 0;
  metrics.conversion_scan_to_customer =
    scansBase > 0
      ? Math.round((metrics.customers_registered / scansBase) * 1000) / 1000
      : 0;
  metrics.conversion_customer_to_order =
    metrics.customers_registered > 0
      ? Math.round((metrics.orders_started / metrics.customers_registered) * 1000) / 1000
      : 0;

  const evaluation = evaluateTrialValidation(metrics, criteria, {
    willingToPay,
  });

  return {
    store_id: storeId,
    period: { from: periodStart, to: periodEnd },
    trial: {
      status: plan.status,
      plan_code: plan.planCode,
      plan_name: plan.planName,
      trial_started_at: plan.trialStartedAt,
      trial_ends_at: plan.trialEndsAt,
      days_remaining: trialDaysRemaining,
      willing_to_pay: willingToPay,
      validation_notes: validationNotes,
    },
    criteria,
    metrics,
    evaluation,
    mock: false,
  };
}

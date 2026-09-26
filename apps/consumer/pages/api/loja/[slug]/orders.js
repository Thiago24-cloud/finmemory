import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getStoreFeatureAccess, unlockPlanNameForFeature } from '../../../../lib/loja/storePlanAccess';
import { createDirectOrder } from '../../../../lib/loja/createDirectOrder';
import { mapPedidoPublic } from '../../../../lib/loja/mapPedidoPublic';

/**
 * POST /api/loja/[slug]/orders — cria pedido direto (guest ok).
 * GET  /api/loja/[slug]/orders?id=&code= — acompanha pedido.
 */
export default async function handler(req, res) {
  const slug = String(req.query.slug || '').trim().toLowerCase();
  if (!slug) return res.status(400).json({ error: 'Slug obrigatório.' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, name, public_slug, phone')
    .eq('public_slug', slug)
    .maybeSingle();

  if (storeErr) return res.status(500).json({ error: storeErr.message });
  if (!store) return res.status(404).json({ error: 'Loja não encontrada.' });

  const access = await getStoreFeatureAccess(supabase, store.id);

  if (req.method === 'GET') {
    const id = String(req.query.id || '').trim();
    const code = String(req.query.code || req.query.pickup_code || '').trim().toUpperCase();
    if (!id && !code) {
      return res.status(400).json({ error: 'Informe id ou code do pedido.' });
    }

    let q = supabase.from('pedidos_loja').select('*').eq('loja_id', store.id);
    if (id) q = q.eq('id', id);
    if (code) q = q.eq('pickup_code', code);
    const { data: pedido, error } = await q.maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado.' });

    const { data: itens } = await supabase
      .from('pedidos_loja_itens')
      .select('id, produto_loja_id, nome, preco_unitario, quantidade, total_price')
      .eq('pedido_id', pedido.id);

    return res.status(200).json({
      store: { id: store.id, name: store.name, slug },
      order: mapPedidoPublic(pedido, itens || []),
    });
  }

  if (req.method === 'POST') {
    if (!access.can('direct_orders')) {
      return res.status(403).json({
        code: 'FEATURE_LOCKED',
        feature: 'direct_orders',
        error: `Essa funcionalidade está disponível no plano ${unlockPlanNameForFeature('direct_orders')}.`,
      });
    }

    const body = req.body || {};
    const orderType = body.order_type === 'delivery' || body.orderType === 'delivery' ? 'delivery' : 'pickup';

    if (orderType === 'pickup' && !access.can('pickup_orders')) {
      return res.status(403).json({
        code: 'FEATURE_LOCKED',
        feature: 'pickup_orders',
        error: `Essa funcionalidade está disponível no plano ${unlockPlanNameForFeature('pickup_orders')}.`,
      });
    }
    if (orderType === 'delivery' && !access.can('local_delivery')) {
      return res.status(403).json({
        code: 'FEATURE_LOCKED',
        feature: 'local_delivery',
        error: `Essa funcionalidade está disponível no plano ${unlockPlanNameForFeature('local_delivery')}.`,
      });
    }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const result = await createDirectOrder(supabase, {
      restaurantId: store.id,
      consumerId: body.consumer_id || body.consumerId || null,
      customerName: body.customer_name || body.customerName || body.name,
      customerPhone: body.customer_phone || body.customerPhone || body.whatsapp,
      orderType,
      notes: body.notes || body.observacao || null,
      source: body.source === 'qr_code' || body.src === 'qr' ? 'qr_code' : 'public_page',
      items: rawItems.map((i) => ({
        productId: i.product_id || i.productId || i.produto_loja_id,
        quantity: i.quantity || i.quantidade,
      })),
    });

    if (!result.ok) {
      const status = result.code === 'FEATURE_LOCKED' ? 403 : result.code === 'MISSING_SCHEMA' ? 503 : 400;
      return res.status(status).json({
        error: result.error,
        code: result.code || null,
        feature: result.feature || null,
      });
    }

    return res.status(201).json({
      ok: true,
      store: { id: store.id, name: result.store_name || store.name, slug },
      order: mapPedidoPublic(result.pedido, result.itens),
      pickup_code: result.pickup_code,
      track_path: `/loja/${encodeURIComponent(slug)}/pedido/${result.pedido.id}?code=${encodeURIComponent(result.pickup_code)}`,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';

/**
 * GET /api/merchant/map/status
 * Retorna métricas rápidas da presença da loja no mapa.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, userId, store } = auth;
  const storeName = String(store?.name || '').trim();

  const nowIso = new Date().toISOString();
  const fromIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [productsRes, promosRes, pointsRes] = await Promise.all([
    supabase
      .from('produtos_loja')
      .select('id, em_oferta, status_disponivel', { count: 'exact', head: false })
      .eq('loja_id', store.id),
    supabase
      .from('promotions')
      .select('id, active, valid_until, created_at', { count: 'exact', head: false })
      .eq('store_id', store.id)
      .eq('source', 'merchant_panel')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('price_points')
      .select('id, created_at', { count: 'exact', head: false })
      .eq('user_id', userId)
      .eq('source', 'merchant_panel')
      .eq('store_name', storeName)
      .gte('created_at', fromIso)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  if (productsRes.error) return res.status(500).json({ error: productsRes.error.message });
  if (promosRes.error) return res.status(500).json({ error: promosRes.error.message });
  if (pointsRes.error) return res.status(500).json({ error: pointsRes.error.message });

  const products = productsRes.data || [];
  const promos = promosRes.data || [];

  const activePromotions = promos.filter((p) => {
    if (!p?.active) return false;
    if (!p?.valid_until) return true;
    return String(p.valid_until) >= nowIso.slice(0, 10);
  }).length;

  const flashReadyProducts = products.filter((p) => p?.em_oferta && p?.status_disponivel).length;

  return res.status(200).json({
    store_id: store.id,
    store_name: storeName,
    total_products: productsRes.count || 0,
    flash_ready_products: flashReadyProducts,
    active_promotions: activePromotions,
    map_publications_last_7d: pointsRes.count || 0,
  });
}

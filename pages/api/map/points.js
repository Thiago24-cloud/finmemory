import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/map/points
 * Retorna pontos do mapa de preços (tabela price_points).
 * user_id é mascarado como "Explorador #XXXX" para exibir no popup.
 */
let supabaseInstance = null;

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

function maskUserId(userId) {
  if (!userId || typeof userId !== 'string') return 'Explorador';
  const last4 = userId.replace(/-/g, '').slice(-4);
  return `Explorador #${last4}`;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `Há ${diffMins} min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays < 7) return `Há ${diffDays} dia(s)`;
  return d.toLocaleDateString('pt-BR');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  try {
    const { data, error } = await supabase
      .from('price_points')
      .select('id, product_name, price, store_name, lat, lng, category, created_at, user_id')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Erro ao buscar price_points:', error);
      return res.status(500).json({ error: error.message });
    }

    const points = (data || []).map((row) => ({
      id: row.id,
      product_name: row.product_name,
      price: row.price,
      store_name: row.store_name,
      lat: Number(row.lat),
      lng: Number(row.lng),
      category: row.category,
      time_ago: formatTimeAgo(row.created_at),
      user_label: maskUserId(row.user_id)
    }));

    return res.status(200).json({ points });
  } catch (e) {
    console.error('Erro em /api/map/points:', e);
    return res.status(500).json({ error: e.message });
  }
}

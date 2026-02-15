import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

/**
 * GET /api/map/points - lista pontos do mapa.
 * POST /api/map/points - divulgar preço (requer login; usa service role para evitar RLS).
 * user_id é mascarado como "Explorador #XXXX" no GET.
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
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.supabaseId;
    if (!userId) {
      return res.status(401).json({ error: 'Faça login para compartilhar preços.' });
    }
    const { product_name, price, store_name, lat, lng, category } = req.body || {};
    if (!product_name || typeof product_name !== 'string' || !product_name.trim()) {
      return res.status(400).json({ error: 'Informe o nome do produto.' });
    }
    if (price === undefined || price === null || isNaN(parseFloat(price))) {
      return res.status(400).json({ error: 'Informe o preço.' });
    }
    if (!store_name || typeof store_name !== 'string' || !store_name.trim()) {
      return res.status(400).json({ error: 'Informe o nome da loja.' });
    }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({ error: 'Ative a localização para compartilhar no mapa.' });
    }
    try {
      const { error: insertErr } = await supabase.from('price_points').insert({
        user_id: userId,
        product_name: String(product_name).trim(),
        price: parseFloat(price),
        store_name: String(store_name).trim(),
        lat: latNum,
        lng: lngNum,
        category: category && String(category).trim() ? String(category).trim() : null
      });
      if (insertErr) {
        console.error('Erro ao inserir price_point:', insertErr);
        return res.status(500).json({ error: insertErr.message || 'Erro ao salvar.' });
      }
      return res.status(201).json({ success: true });
    } catch (e) {
      console.error('POST /api/map/points:', e);
      return res.status(500).json({ error: e.message || 'Erro ao salvar.' });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

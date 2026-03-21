import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { geocodeAddress } from '../../../lib/geocode';

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
    const storeNameStr = String(store_name).trim();
    // Priorizar o endereço da loja (onde o preço foi visto), não a localização de quem divulgou
    let latNum = NaN;
    let lngNum = NaN;
    const coordsFromGeocode = await geocodeAddress(`${storeNameStr}, Brasil`) || await geocodeAddress(`${storeNameStr}, São Paulo, Brasil`);
    if (coordsFromGeocode && coordsFromGeocode.lat != null && coordsFromGeocode.lng != null) {
      latNum = coordsFromGeocode.lat;
      lngNum = coordsFromGeocode.lng;
    }
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      latNum = parseFloat(lat);
      lngNum = parseFloat(lng);
    }
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({ error: 'Não foi possível localizar a loja. Informe o endereço completo ou ative a localização.' });
    }
    try {
      const { error: insertErr } = await supabase.from('price_points').insert({
        user_id: userId,
        product_name: String(product_name).trim(),
        price: parseFloat(price),
        store_name: storeNameStr,
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
    const q = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    // TTL padrão: 24h (preços divulgados por usuários).
    const defaultTtlHours = Math.max(
      1,
      Number.parseInt(process.env.MAP_DEFAULT_TTL_HOURS || '24', 10) || 24
    );
    // Promoções (ex.: import DIA — category com "promo") ficam mais tempo no ar.
    const promoTtlHours = Math.max(
      defaultTtlHours,
      Number.parseInt(process.env.MAP_PROMO_TTL_HOURS || '168', 10) || 168
    );
    const normalCutoffIso = new Date(
      Date.now() - defaultTtlHours * 60 * 60 * 1000
    ).toISOString();
    const promoCutoffIso = new Date(
      Date.now() - promoTtlHours * 60 * 60 * 1000
    ).toISOString();

    const baseSelect =
      'id, product_name, price, store_name, lat, lng, category, created_at, user_id';

    const applySearch = (qb) => {
      if (q.length < 2) return qb;
      const pattern = `%${q}%`;
      return qb.or(
        `product_name.ilike.${pattern},store_name.ilike.${pattern},category.ilike.${pattern}`
      );
    };

    // 1) Ofertas/promoções (import DIA etc.): TTL maior
    let promoQuery = applySearch(
      supabase
        .from('price_points')
        .select(baseSelect)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .ilike('category', '%promo%')
        .gte('created_at', promoCutoffIso)
        .order('created_at', { ascending: false })
        .limit(500)
    );

    // 2) Demais pontos: TTL curto (categoria sem "promo" ou nula) — duas queries para evitar edge cases do PostgREST
    let normalNullQuery = applySearch(
      supabase
        .from('price_points')
        .select(baseSelect)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .is('category', null)
        .gte('created_at', normalCutoffIso)
        .order('created_at', { ascending: false })
        .limit(500)
    );
    let normalOtherQuery = applySearch(
      supabase
        .from('price_points')
        .select(baseSelect)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .not('category', 'ilike', '%promo%')
        .gte('created_at', normalCutoffIso)
        .order('created_at', { ascending: false })
        .limit(500)
    );

    const [
      { data: promoRows, error: promoErr },
      { data: normalNullRows, error: normalNullErr },
      { data: normalOtherRows, error: normalOtherErr },
    ] = await Promise.all([promoQuery, normalNullQuery, normalOtherQuery]);

    if (promoErr) {
      console.error('Erro ao buscar price_points (promo):', promoErr);
      return res.status(500).json({ error: promoErr.message });
    }
    if (normalNullErr) {
      console.error('Erro ao buscar price_points (normal null):', normalNullErr);
      return res.status(500).json({ error: normalNullErr.message });
    }
    if (normalOtherErr) {
      console.error('Erro ao buscar price_points (normal):', normalOtherErr);
      return res.status(500).json({ error: normalOtherErr.message });
    }

    const byId = new Map();
    for (const row of [
      ...(promoRows || []),
      ...(normalNullRows || []),
      ...(normalOtherRows || []),
    ]) {
      if (row?.id) byId.set(row.id, row);
    }
    const merged = Array.from(byId.values()).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    const data = merged.slice(0, 500);

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

import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

/**
 * GET /api/map/produtos-proximos?lat=&lng=&raio_km=3
 * Ofertas ativas de lojas no raio (usa RPC produtos_oferta_proximos).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const raioKm = Number(req.query.raio_km ?? req.query.raio ?? 3);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Informe lat e lng.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const { data, error } = await supabase.rpc('produtos_oferta_proximos', {
    p_lat: lat,
    p_lng: lng,
    p_raio_km: Number.isFinite(raioKm) ? raioKm : 3,
  });

  if (error) {
    if (error.message?.includes('produtos_oferta_proximos')) {
      return res.status(503).json({
        error: 'Função produtos_oferta_proximos não encontrada. Aplique a migração 20260519120000.',
      });
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ items: data || [], count: (data || []).length });
}

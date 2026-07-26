import { requireAdminCreditsApi } from '../../../../../../lib/credits/requireCreditsApi';
import { findPurchaseLocationsForInsumo } from '../../../../../../lib/adm/bridgeInsumoPurchaseLocations';

/**
 * GET /api/parceiros/adm/bridge/insumos/comprar-onde?q=&ean=&lat=&lng=&custo=
 * Lojas próximas onde comprar o insumo (geolocalização opcional).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  const q = String(req.query.q || req.query.nome || '').trim();
  if (q.length < 2) {
    return res.status(400).json({ error: 'Informe o nome do produto (q).' });
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const custo = Number(req.query.custo);
  const radiusKm = Number(req.query.radius_km);

  try {
    const result = await findPurchaseLocationsForInsumo(ctx.supabase, {
      nome: q,
      ean: req.query.ean ? String(req.query.ean).trim() : null,
      custo_medio: Number.isFinite(custo) ? custo : null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      radius_km: Number.isFinite(radiusKm) ? radiusKm : null,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.warn('[adm/bridge/insumos/comprar-onde]', err.message);
    return res.status(500).json({ error: 'Não foi possível buscar lojas próximas.' });
  }
}

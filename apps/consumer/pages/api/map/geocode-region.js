import { geocodeRegionQuery } from '../../../lib/geocodeRegion';

/**
 * GET /api/map/geocode-region?q=Grajaú
 * Resolve um nome de região (bairro, cidade, etc.) para centro + bbox no Brasil.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    return res.status(400).json({ ok: false, error: 'Informe pelo menos 2 caracteres.' });
  }

  try {
    const result = await geocodeRegionQuery(q);
    if (!result) {
      return res.status(200).json({ ok: false });
    }
    return res.status(200).json({
      ok: true,
      label: result.label,
      center: result.center,
      bbox: result.bbox,
    });
  } catch (e) {
    console.error('[geocode-region]', e);
    return res.status(500).json({ ok: false, error: e.message || 'Erro ao geocodificar.' });
  }
}

import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { fetchCestaCompareForStore } from '../../../../lib/merchant/compras/fetchCestaCompare';
import { fetchMapOffersForInsumos } from '../../../../lib/merchant/compras/fetchMapOffersForInsumos';
import { simulateCestaSelections } from '../../../../lib/merchant/compras/cestaCompare';

/**
 * POST /api/merchant/compras/simulate
 * Body: { selections: [{ insumoId, offer }] }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;
  const body = req.body || {};
  const selections = Array.isArray(body.selections) ? body.selections : [];

  const loaded = await fetchCestaCompareForStore(supabase, store.id, { autoEnrichMatch: false });
  if (!loaded.ok) {
    console.warn('[compras/simulate]', loaded.error?.message);
    return res.status(500).json({ error: 'Não foi possível simular a cesta.' });
  }
  if (!loaded.cestaAvailable) {
    return res.status(503).json({
      error: 'Cesta de compras ainda não disponível.',
      code: 'CESTA_MIGRATION_REQUIRED',
    });
  }

  const mapRows = await fetchMapOffersForInsumos(supabase, loaded.insumos || []);
  const compare = simulateCestaSelections(loaded.insumos, mapRows, selections);
  return res.status(200).json(compare);
}

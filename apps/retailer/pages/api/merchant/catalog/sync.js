import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { syncInsumosToCatalog } from '../../../../lib/merchant/syncInsumosToCatalog';

/**
 * POST /api/merchant/catalog/sync — promove insumos (com custo) para produtos_loja.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;
  const result = await syncInsumosToCatalog(supabase, { lojaId: store.id });

  if (!result.ok) {
    return res.status(500).json({ error: result.error || 'Erro ao sincronizar catálogo.' });
  }

  return res.status(200).json({
    synced: result.synced,
    skipped: result.skipped,
    products: result.products,
  });
}

/** GET /api/parceiros/painel/lista-compras/compare?names=arroz,pera,sabão */
import { requireMerchantSession } from '../../../../../lib/merchant/requireMerchantApi';
import { compareListWithMapOffers } from '../../../../../lib/shoppingListMapCompare';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireMerchantSession(req, res);
  if (!ctx) return;

  const namesParam = typeof req.query.names === 'string' ? req.query.names : '';
  if (!namesParam.trim()) {
    return res.status(400).json({ error: 'Informe os produtos (ex.: ?names=arroz,pera,sabão).' });
  }

  const productNames = namesParam
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((n) => n.length >= 2)
    .slice(0, 24);

  if (productNames.length === 0) {
    return res.status(400).json({ error: 'Nenhum produto válido na lista.' });
  }

  const { data: rpcRows, error } = await ctx.supabase.rpc('buscar_lojas_por_produtos_lista', {
    produtos: productNames,
  });

  if (error) {
    console.warn('[lista-compras/compare]', error.message);
    return res.status(500).json({ error: 'Não foi possível buscar preços no mapa.' });
  }

  const result = compareListWithMapOffers(productNames, rpcRows);
  return res.status(200).json(result);
}

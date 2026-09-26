import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { fetchInsumoPriceHistory } from '../../../../lib/merchant/compras/insumoPriceHistory';

/**
 * GET /api/merchant/compras/price-history?insumoId=
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireMerchantApi(req, res);
  if (!ctx) return;

  const insumoId = String(req.query.insumoId || '').trim();
  if (!insumoId) return res.status(400).json({ error: 'insumoId é obrigatório' });

  const { data: insumo, error } = await ctx.supabase
    .from('insumos_loja')
    .select('id, nome, custo_medio')
    .eq('id', insumoId)
    .eq('loja_id', ctx.store.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!insumo) return res.status(404).json({ error: 'Insumo não encontrado' });

  const history = await fetchInsumoPriceHistory(ctx.supabase, {
    lojaId: ctx.store.id,
    insumoId: insumo.id,
    nome: insumo.nome,
    days: Number(req.query.days) || 90,
  });

  return res.status(200).json({
    insumo: { id: insumo.id, nome: insumo.nome, custo_medio: insumo.custo_medio },
    ...history,
  });
}

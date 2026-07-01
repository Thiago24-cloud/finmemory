import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';

/** GET /api/merchant/vendas/resumo — KPIs das últimas 24h e total */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireMerchantApi(req, res);
  if (!ctx) return;

  const lojaId = ctx.store.id;

  const { data: vendas, error } = await ctx.supabase
    .from('vendas_terminal')
    .select('valor_total, status, created_at, vendido_em')
    .eq('loja_id', lojaId);

  if (error) {
    console.error('[vendas/resumo]', error);
    return res.status(500).json({ error: 'Erro ao buscar resumo' });
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let totalVendas = 0;
  let receitaTotal = 0;
  let receitaHoje = 0;
  let vendasHoje = 0;

  for (const v of vendas || []) {
    totalVendas += 1;
    if (v.status !== 'aprovado') continue;
    const valor = Number(v.valor_total) || 0;
    receitaTotal += valor;
    const ts = new Date(v.vendido_em || v.created_at).getTime();
    if (now - ts <= dayMs) {
      receitaHoje += valor;
      vendasHoje += 1;
    }
  }

  return res.status(200).json({
    total_vendas: totalVendas,
    receita_total: receitaTotal,
    receita_hoje: receitaHoje,
    vendas_hoje: vendasHoje,
  });
}

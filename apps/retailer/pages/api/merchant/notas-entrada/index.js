import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';

/**
 * GET /api/merchant/notas-entrada — histórico recente
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;

  const { data, error } = await supabase
    .from('notas_entrada_loja')
    .select('id, fornecedor, chave_nfe, valor_total, status, created_at')
    .eq('loja_id', store.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    if (/notas_entrada/i.test(error.message)) {
      return res.status(503).json({
        error: 'Execute a migração de insumos/notas no Supabase.',
      });
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ notas: data || [] });
}

import { requireMerchantApi } from '../../../../../lib/merchant/requireMerchantApi';
import { approveInsumoImport } from '../../../../../lib/merchant/insumos/confirmInsumoImport';

/**
 * POST /api/merchant/insumos/import/approve
 * Aprova lote ou insumos pendentes → ativos no estoque.
 *
 * Body: { lote_id?, insumo_ids? }
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
  const loteId = body.lote_id ?? body.loteId ?? null;
  const insumoIds = body.insumo_ids ?? body.insumoIds ?? null;

  const result = await approveInsumoImport(supabase, store.id, {
    loteId,
    insumoIds,
  });

  if (!result.ok) {
    return res.status(500).json({ error: result.error });
  }

  return res.status(200).json({
    ok: true,
    approved: result.approved,
    message:
      result.approved > 0
        ? `${result.approved} insumo(s) ativado(s) no estoque.`
        : 'Nenhum item pendente encontrado.',
  });
}

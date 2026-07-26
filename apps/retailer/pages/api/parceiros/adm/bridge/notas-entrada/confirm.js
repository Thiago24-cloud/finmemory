import { requireAdminCreditsApi } from '../../../../../../lib/credits/requireCreditsApi';
import { confirmNotaEntrada } from '../../../../../../lib/merchant/confirmNotaEntrada';

/**
 * POST /api/parceiros/adm/bridge/notas-entrada/confirm
 * Body: { store_id, fornecedor, chave_nfe, valor_total, imagem_url, itens[] }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  const body = req.body || {};
  const storeId = String(body.store_id || '').trim();
  if (!storeId) {
    return res.status(400).json({ error: 'Informe store_id.' });
  }

  const { data: store } = await ctx.supabase
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .maybeSingle();

  if (!store) {
    return res.status(404).json({ error: 'Loja não encontrada.' });
  }

  const result = await confirmNotaEntrada(ctx.supabase, {
    lojaId: storeId,
    fornecedor: body.fornecedor || body.merchant_name,
    chave_nfe: body.chave_nfe,
    valor_total: body.valor_total,
    imagem_url: body.imagem_url,
    itens: body.itens,
  });

  if (!result.ok) {
    const status = result.status || 500;
    if (/notas_entrada/i.test(String(result.error))) {
      return res.status(503).json({
        error: 'Tabelas de nota de entrada ainda não existem. Execute run-insumos-loja-migration.sql.',
      });
    }
    return res.status(status).json({ error: result.error });
  }

  return res.status(201).json({
    success: true,
    nota: result.nota,
    movimentos: result.movimentos,
    insumos_criados: result.insumos_criados,
    insumo_ids: result.insumo_ids || [],
    itens_confirmados: result.itens_confirmados,
    message: `Entrada confirmada: ${result.itens_confirmados} item(ns) no estoque.`,
    consumer_export: { synced: true },
  });
}

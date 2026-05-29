import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { confirmNotaEntrada } from '../../../../lib/merchant/confirmNotaEntrada';

/**
 * POST /api/merchant/notas-entrada/confirm
 * Body: { fornecedor, chave_nfe, valor_total, imagem_url, itens[] }
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

  const result = await confirmNotaEntrada(supabase, {
    lojaId: store.id,
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
    message: `Entrada confirmada: ${result.itens_confirmados} item(ns) no estoque.`,
  });
}

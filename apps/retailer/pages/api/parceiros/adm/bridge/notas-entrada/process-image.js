import { requireAdminCreditsApi } from '../../../../../../lib/credits/requireCreditsApi';
import { processReceiptImage, ensureReceiptStorageReady } from '../../../../../../lib/ocr/processReceiptImage';
import { mapNotaItemForReview } from '../../../../../../lib/merchant/suggestInsumoMatch';

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
};

/**
 * POST /api/parceiros/adm/bridge/notas-entrada/process-image
 * Body: { store_id, imageBase64, fileName? }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ensureReceiptStorageReady(res)) return;

  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  const { store_id: storeId, imageBase64, fileName } = req.body || {};
  if (!storeId) {
    return res.status(400).json({ success: false, error: 'Informe store_id.' });
  }
  if (!imageBase64) {
    return res.status(400).json({ success: false, error: 'Envie a foto da nota fiscal.' });
  }

  const { data: store } = await ctx.supabase
    .from('stores')
    .select('id, owner_user_id')
    .eq('id', storeId)
    .maybeSingle();

  if (!store) {
    return res.status(404).json({ success: false, error: 'Loja não encontrada.' });
  }

  const userId = store.owner_user_id;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'Loja sem proprietário vinculado.' });
  }

  const result = await processReceiptImage(ctx.supabase, { userId, imageBase64, fileName });
  if (!result.ok) {
    return res.status(result.status || 500).json({
      success: false,
      error: result.error,
      details: result.details,
      isInvalidReceipt: result.isInvalidReceipt,
    });
  }

  const { data: insumos } = await ctx.supabase
    .from('insumos_loja')
    .select('id, nome, ean')
    .eq('loja_id', storeId)
    .eq('ativo', true)
    .limit(500);

  const items = (result.data.items || []).map((item) => mapNotaItemForReview(insumos || [], item));

  return res.status(200).json({
    success: true,
    draft: {
      fornecedor: result.data.merchant_name,
      merchant_cnpj: result.data.merchant_cnpj,
      date: result.data.date,
      valor_total: result.data.total_amount,
      imagem_url: result.data.receipt_image_url,
      chave_nfe: result.data.chave_nfe,
      nfce_url: result.data.nfce_url,
      itens: items,
    },
  });
}

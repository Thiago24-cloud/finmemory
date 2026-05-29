import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { fetchNfceFromQr } from '../../../../lib/ocr/fetchNfceFromQr';
import { mapNotaItemForReview } from '../../../../lib/merchant/suggestInsumoMatch';

/**
 * POST /api/merchant/notas-entrada/fetch-nfce
 * Body: { qrContent | url }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;
  const qrContent = req.body?.qrContent || req.body?.url;
  if (!qrContent) {
    return res.status(400).json({ success: false, error: 'Cole o link ou conteúdo do QR da NFC-e.' });
  }

  const fetched = await fetchNfceFromQr(qrContent);
  if (!fetched.ok) {
    return res.status(fetched.error?.includes('demais') ? 408 : 500).json({
      success: false,
      error: fetched.error,
    });
  }

  const { data: insumos } = await supabase
    .from('insumos_loja')
    .select('id, nome, ean')
    .eq('loja_id', store.id)
    .eq('ativo', true)
    .limit(500);

  const items = (fetched.data.items || []).map((item) => mapNotaItemForReview(insumos || [], item));

  return res.status(200).json({
    success: true,
    partial: Boolean(fetched.partial),
    message: fetched.message,
    draft: {
      fornecedor: fetched.data.merchant_name,
      merchant_cnpj: fetched.data.merchant_cnpj,
      date: fetched.data.date,
      valor_total: fetched.data.total_amount,
      imagem_url: fetched.data.receipt_image_url,
      chave_nfe: fetched.data.chave_nfe,
      nfce_url: fetched.data.nfce_url,
      itens: items,
    },
  });
}

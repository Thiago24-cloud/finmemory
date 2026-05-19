import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { buildMerchantProductImageR2Key } from '../../../../lib/merchant/buildProductImageR2Key';
import { parseProductImageBase64 } from '../../../../lib/merchant/parseProductImageBase64';
import { isR2Configured, uploadToR2 } from '../../../../lib/uploadToR2';

/**
 * POST /api/merchant/products/upload-image
 * Body: { imageBase64: string, productId?: string }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  if (!isR2Configured()) {
    return res.status(503).json({
      error: 'Upload de fotos indisponível. Configure Cloudflare R2 ou use URL da imagem.',
    });
  }

  const parsed = parseProductImageBase64(req.body?.imageBase64);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const productId =
    typeof req.body?.productId === 'string' && req.body.productId.trim()
      ? req.body.productId.trim().slice(0, 64)
      : `tmp-${Date.now()}`;

  const key = buildMerchantProductImageR2Key(auth.store.id, productId, parsed.ext);
  const upload = await uploadToR2(parsed.buffer, key, parsed.mimeType);

  if (!upload.success) {
    return res.status(500).json({
      error: upload.error?.message || 'Falha ao enviar imagem.',
    });
  }

  return res.status(200).json({
    url: upload.url,
    key: upload.key,
  });
}

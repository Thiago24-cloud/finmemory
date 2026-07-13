import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { buildMerchantProductImageR2Key } from '../../../../lib/merchant/buildProductImageR2Key';
import { parseProductImageBase64 } from '../../../../lib/merchant/parseProductImageBase64';
import { isR2Configured, uploadToR2 } from '../../../../lib/uploadToR2';

/**
 * POST /api/merchant/insumos/upload-image
 * Body: { imageBase64: string, insumoId?: string }
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
      error: 'Upload de fotos indisponível. Configure Cloudflare R2.',
    });
  }

  const parsed = parseProductImageBase64(req.body?.imageBase64);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const insumoId =
    typeof req.body?.insumoId === 'string' && req.body.insumoId.trim()
      ? req.body.insumoId.trim().slice(0, 64)
      : `insumo-${Date.now()}`;

  const key = buildMerchantProductImageR2Key(auth.store.id, `insumos/${insumoId}`, parsed.ext);
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

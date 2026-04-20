import { requireMapQuickAddAdminForApi } from '../../../lib/requireMapQuickAddAdminApi';
import { resolveThumbnailRuleImageInput } from '../../../lib/mapThumbnailRuleImageUpload';

/**
 * POST — envia uma data URL (ou https) e devolve URL pública https do Storage quando for base64.
 * Body: { image_url: string }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const ctx = await requireMapQuickAddAdminForApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  const raw = typeof req.body?.image_url === 'string' ? req.body.image_url.trim() : '';
  if (!raw) {
    return res.status(400).json({ error: 'image_url obrigatório' });
  }

  try {
    const url = await resolveThumbnailRuleImageInput(supabase, raw);
    if (!url || !/^https:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Não foi possível obter URL HTTPS' });
    }
    return res.status(200).json({ url });
  } catch (e) {
    return res.status(400).json({ error: e?.message || 'Upload inválido' });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

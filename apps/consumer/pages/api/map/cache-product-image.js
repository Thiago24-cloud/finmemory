import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getMapQuickAddSupabase, resolveQuickAddAuth } from '../../../lib/mapQuickAddCore';
import { isValidResolvedImage } from '../../../lib/externalProductImages';
import { upsertImageCacheRow } from '../../../lib/mapProductImageCache';

/**
 * POST /api/map/cache-product-image
 * Grava miniatura no repositório persistente (map_product_image_cache) para reutilizar em todas as lojas.
 * Body: { product_name, image_url }
 *
 * Auth: sessão NextAuth ou x-map-quick-add-secret (igual ao Quick Add).
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getMapQuickAddSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  const session = await getServerSession(req, res, authOptions);
  const auth = resolveQuickAddAuth(req, session);
  if (auth?.error === 'invalid_secret') {
    return res.status(403).json({ error: 'x-map-quick-add-secret inválido.' });
  }
  if (auth?.error === 'secret_not_configured') {
    return res.status(503).json({ error: 'MAP_QUICK_ADD_SECRET não configurado no servidor.' });
  }
  if (auth?.error === 'bot_user_missing') {
    return res.status(503).json({ error: 'Configure MAP_QUICK_ADD_BOT_USER_ID para uso com segredo.' });
  }
  if (!auth?.userId) {
    return res.status(401).json({ error: 'Faça login ou envie x-map-quick-add-secret válido.' });
  }

  const body = req.body || {};
  const productName =
    typeof body.product_name === 'string' ? body.product_name.trim() : '';
  const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : '';

  if (!productName || productName.length < 2) {
    return res.status(400).json({ error: 'product_name é obrigatório.' });
  }
  if (!imageUrl || !isValidResolvedImage(imageUrl)) {
    return res.status(400).json({ error: 'image_url https inválida ou não parece imagem.' });
  }

  const ok = await upsertImageCacheRow(supabase, productName, imageUrl, 'manual_url');
  if (!ok) {
    return res.status(500).json({ error: 'Não foi possível gravar no cache.' });
  }

  return res.status(200).json({ ok: true, product_name: productName });
}

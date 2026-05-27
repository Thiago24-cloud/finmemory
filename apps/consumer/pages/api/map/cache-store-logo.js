import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getMapQuickAddSupabase, resolveQuickAddAuth } from '../../../lib/mapQuickAddCore';
import { isValidResolvedImage } from '../../../lib/externalProductImages';
import { upsertStoreLogoCacheRow } from '../../../lib/mapStoreLogoCache';

/**
 * POST /api/map/cache-store-logo
 * Body: { store_name, image_url }
 * Grava em map_store_logo_cache — o mapa usa em GET /api/map/stores (pin_logo_url).
 *
 * Auth: sessão NextAuth ou x-map-quick-add-secret (igual ao Quick Add / cache-product-image).
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
  const storeName = typeof body.store_name === 'string' ? body.store_name.trim() : '';
  const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : '';

  if (!storeName || storeName.length < 2) {
    return res.status(400).json({ error: 'store_name é obrigatório (nome da loja como no cadastro).' });
  }
  if (!imageUrl || !isValidResolvedImage(imageUrl)) {
    return res.status(400).json({ error: 'image_url https inválida ou não parece imagem.' });
  }

  const ok = await upsertStoreLogoCacheRow(supabase, storeName, imageUrl, 'manual_url');
  if (!ok) {
    return res.status(500).json({ error: 'Não foi possível gravar o logo. Confirme a migração map_store_logo_cache no Supabase.' });
  }

  return res.status(200).json({ ok: true, store_name: storeName });
}

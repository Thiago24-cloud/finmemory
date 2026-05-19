import { requireMerchantSession } from '../../../lib/merchant/requireMerchantApi';
import { ensureMerchantStoreLink } from '../../../lib/merchant/ensureMerchantStoreLink';

/**
 * POST /api/merchant/repair-link — re-sincroniza vínculo lojista ↔ loja (após migrações ou cadastro incompleto).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantSession(req, res);
  if (!auth) return;

  const ctx = await ensureMerchantStoreLink(auth.supabase, auth.userId);
  if (!ctx?.store?.id) {
    return res.status(404).json({
      code: 'MERCHANT_STORE_NOT_LINKED',
      error: 'Nenhuma loja encontrada para esta conta. Cadastre-se em /parceiros.',
      linked: false,
    });
  }

  return res.status(200).json({
    linked: true,
    store: {
      id: ctx.store.id,
      name: ctx.store.name,
      lat: ctx.store.lat,
      lng: ctx.store.lng,
    },
  });
}

import { requireAdminCreditsApi } from '../../../../../lib/credits/requireCreditsApi';
import { getWalletWithTransactions } from '../../../../../lib/credits/walletService';

/**
 * GET /api/parceiros/adm/bridge/wallet?user_id=
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  const userId = String(req.query.user_id || '').trim();
  if (!userId) {
    return res.status(400).json({ error: 'Informe user_id.' });
  }

  try {
    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const { wallet, transactions } = await getWalletWithTransactions(ctx.supabase, userId, { limit });
    return res.status(200).json({ wallet, transactions });
  } catch (err) {
    console.warn('[adm/bridge/wallet]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

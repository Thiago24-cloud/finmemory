import { requireUserCreditsApi } from '../../../lib/credits/requireCreditsApi';
import { getWalletWithTransactions } from '../../../lib/credits/walletService';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireUserCreditsApi(req, res);
  if (!ctx) return;

  try {
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const data = await getWalletWithTransactions(ctx.supabase, ctx.userId, { limit });
    return res.status(200).json({ transactions: data.transactions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

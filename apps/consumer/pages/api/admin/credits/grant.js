import { requireAdminCreditsApi } from '../../../lib/credits/requireCreditsApi';
import { postLedgerTransaction } from '../../../lib/credits/walletService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  const body = req.body || {};
  const userId = String(body.user_id || '').trim();
  const amount = Number(body.amount);
  const description = String(body.description || 'Ajuste administrativo').trim();

  if (!userId || !Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ error: 'user_id e amount válidos são obrigatórios.' });
  }

  try {
    const result = await postLedgerTransaction(ctx.supabase, {
      userId,
      type: amount > 0 ? 'admin_adjustment' : 'credit_redeemed',
      amount,
      description,
      sourceType: 'admin',
      metadata: { admin_email: ctx.email },
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

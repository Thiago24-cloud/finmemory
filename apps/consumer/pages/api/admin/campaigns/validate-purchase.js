import { requireAdminCreditsApi } from '../../../lib/credits/requireCreditsApi';
import { validatePurchaseAndGrantCredit } from '../../../lib/credits/purchaseValidationService';
import { getWalletWithTransactions } from '../../../lib/credits/walletService';
import { VALIDATION_SOURCES } from '../../../lib/credits/constants';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  const body = req.body || {};
  const userId = String(body.user_id || '').trim();
  const campaignId = String(body.campaign_id || '').trim();

  if (!userId || !campaignId) {
    return res.status(400).json({ error: 'user_id e campaign_id são obrigatórios.' });
  }

  try {
    const result = await validatePurchaseAndGrantCredit(ctx.supabase, {
      userId,
      campaignId,
      productName: body.product_name,
      productBrand: body.product_brand,
      marketName: body.market_name,
      purchaseAmount: body.purchase_amount,
      validationSource: body.validation_source || VALIDATION_SOURCES.SIMULATED,
      metadata: body.metadata || {},
    });

    const wallet = await getWalletWithTransactions(ctx.supabase, userId, { limit: 5 });

    return res.status(200).json({
      ok: true,
      message: 'Compra validada e crédito concedido.',
      validation: result.validation,
      campaign: result.campaign,
      transaction: result.ledger?.transaction,
      balance: result.ledger?.balance,
      wallet: wallet.wallet,
      recent_transactions: wallet.transactions,
    });
  } catch (err) {
    console.warn('[admin/validate-purchase]', err.message);
    return res.status(400).json({ error: err.message || 'Falha na validação.' });
  }
}

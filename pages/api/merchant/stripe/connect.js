import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import {
  createStripeConnectAccountLink,
  ensureStripeConnectAccount,
  isStoreStripeConnectReady,
  refreshStripeConnectStoreFlags,
} from '../../../../lib/stripe/connectMerchant';
import { isStripeConnectOrdersEnabled } from '../../../../lib/stripe/stripeClient';

/**
 * POST /api/merchant/stripe/connect — inicia/atualiza onboarding Stripe Connect Express.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isStripeConnectOrdersEnabled()) {
    return res.status(503).json({ error: 'Pagamentos Connect desativados no servidor.' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store, session } = auth;
  const email = session?.user?.email;
  const userId = session?.user?.supabaseId;

  const ensured = await ensureStripeConnectAccount(supabase, {
    store,
    userEmail: email,
    userId,
  });
  if (!ensured.ok) {
    return res.status(500).json({ error: ensured.error });
  }

  const linkType = isStoreStripeConnectReady(store) ? 'update' : 'onboarding';
  const link = await createStripeConnectAccountLink(supabase, {
    storeId: store.id,
    accountId: ensured.accountId,
    type: linkType,
  });

  if (!link.ok) {
    return res.status(500).json({ error: link.error });
  }

  await refreshStripeConnectStoreFlags(supabase, store.id);

  return res.status(200).json({ url: link.url });
}

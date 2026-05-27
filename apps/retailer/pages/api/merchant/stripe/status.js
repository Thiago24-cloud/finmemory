import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import {
  isStoreStripeConnectReady,
  refreshStripeConnectStoreFlags,
} from '../../../../lib/stripe/connectMerchant';
import { isStripeConnectOrdersEnabled, stripeConnectPlatformFeePercent } from '../../../../lib/stripe/stripeClient';

/**
 * GET /api/merchant/stripe/status — estado do Connect da loja logada.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;

  let row = store;
  if (isStripeConnectOrdersEnabled() && store?.id) {
    const refreshed = await refreshStripeConnectStoreFlags(supabase, store.id);
    if (refreshed) {
      const { data } = await supabase
        .from('stores')
        .select(
          'stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_onboarded_at'
        )
        .eq('id', store.id)
        .maybeSingle();
      if (data) row = { ...store, ...data };
    }
  }

  return res.status(200).json({
    enabled: isStripeConnectOrdersEnabled(),
    ready: isStoreStripeConnectReady(row),
    account_id: row.stripe_connect_account_id || null,
    charges_enabled: Boolean(row.stripe_connect_charges_enabled),
    payouts_enabled: Boolean(row.stripe_connect_payouts_enabled),
    onboarded_at: row.stripe_connect_onboarded_at || null,
    platform_fee_percent: stripeConnectPlatformFeePercent(),
  });
}

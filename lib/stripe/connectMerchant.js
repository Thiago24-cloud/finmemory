import { getStripe, stripeAppBaseUrl } from './stripeClient';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ store: Record<string, unknown>, userEmail: string, userId: string }} ctx
 */
export async function ensureStripeConnectAccount(supabase, ctx) {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: 'Stripe não configurado no servidor.' };

  const store = ctx.store;
  let accountId = String(store.stripe_connect_account_id || '').trim();

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'BR',
      email: ctx.userEmail || undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        store_id: String(store.id),
        owner_user_id: ctx.userId,
      },
    });
    accountId = account.id;

    const { error } = await supabase
      .from('stores')
      .update({
        stripe_connect_account_id: accountId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', store.id);

    if (error) {
      console.error('[connectMerchant] save account id:', error.message);
      return { ok: false, error: error.message };
    }
  }

  return { ok: true, accountId };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} storeId
 */
export async function refreshStripeConnectStoreFlags(supabase, storeId) {
  const stripe = getStripe();
  if (!stripe) return null;

  const { data: store } = await supabase
    .from('stores')
    .select('id, stripe_connect_account_id')
    .eq('id', storeId)
    .maybeSingle();

  const accountId = String(store?.stripe_connect_account_id || '').trim();
  if (!accountId) return null;

  const account = await stripe.accounts.retrieve(accountId);
  const charges = Boolean(account.charges_enabled);
  const payouts = Boolean(account.payouts_enabled);
  const patch = {
    stripe_connect_charges_enabled: charges,
    stripe_connect_payouts_enabled: payouts,
    updated_at: new Date().toISOString(),
  };
  if (charges && payouts && !store?.stripe_connect_onboarded_at) {
    patch.stripe_connect_onboarded_at = new Date().toISOString();
  }

  await supabase.from('stores').update(patch).eq('id', storeId);

  return { charges_enabled: charges, payouts_enabled: payouts, accountId };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ storeId: string, accountId: string, type: 'onboarding' | 'update' }} input
 */
export async function createStripeConnectAccountLink(supabase, input) {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: 'Stripe não configurado.' };

  const origin = stripeAppBaseUrl();
  const link = await stripe.accountLinks.create({
    account: input.accountId,
    refresh_url: `${origin}/parceiros/painel?stripe_connect=refresh`,
    return_url: `${origin}/parceiros/painel?stripe_connect=done`,
    type: input.type === 'update' ? 'account_update' : 'account_onboarding',
  });

  await refreshStripeConnectStoreFlags(supabase, input.storeId);

  return { ok: true, url: link.url };
}

/**
 * @param {Record<string, unknown> | null | undefined} store
 */
export function isStoreStripeConnectReady(store) {
  if (!store) return false;
  return (
    Boolean(String(store.stripe_connect_account_id || '').trim()) &&
    store.stripe_connect_charges_enabled === true
  );
}

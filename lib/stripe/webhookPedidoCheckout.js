import { confirmPedidoPayment, cancelPedidoPaymentPending } from '../merchant/pedidos/confirmPedidoPayment';
import { CHECKOUT_META } from '../merchant/pedidos/createPedidoCheckout';
import { refreshStripeConnectStoreFlags } from './connectMerchant';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('stripe').Stripe.Checkout.Session} session
 */
export async function handlePedidoCheckoutSession(supabase, session) {
  if (session.metadata?.finmemory_checkout !== CHECKOUT_META) {
    return { handled: false };
  }

  const pedidoId = session.metadata?.pedido_id;
  if (!pedidoId) {
    console.warn('[webhookPedido] session sem pedido_id', session.id);
    return { handled: true, ok: false };
  }

  if (session.payment_status === 'paid' || session.status === 'complete') {
    const pi =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    const result = await confirmPedidoPayment(supabase, {
      pedidoId,
      paymentIntentId: pi || null,
      checkoutSessionId: session.id,
    });
    return { handled: true, ok: result.ok, pedidoId };
  }

  return { handled: true, ok: true, skipped: true };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('stripe').Stripe.Checkout.Session} session
 */
export async function handlePedidoCheckoutExpired(supabase, session) {
  if (session.metadata?.finmemory_checkout !== CHECKOUT_META) {
    return { handled: false };
  }
  const pedidoId = session.metadata?.pedido_id;
  if (pedidoId) {
    await cancelPedidoPaymentPending(supabase, pedidoId);
  }
  return { handled: true };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('stripe').Stripe.Account} account
 */
export async function handleConnectAccountUpdated(supabase, account) {
  const storeId = account.metadata?.store_id;
  if (!storeId) return { handled: false };

  await supabase
    .from('stores')
    .update({
      stripe_connect_charges_enabled: Boolean(account.charges_enabled),
      stripe_connect_payouts_enabled: Boolean(account.payouts_enabled),
      updated_at: new Date().toISOString(),
      ...(account.charges_enabled && account.payouts_enabled
        ? { stripe_connect_onboarded_at: new Date().toISOString() }
        : {}),
    })
    .eq('id', storeId);

  await refreshStripeConnectStoreFlags(supabase, storeId);
  return { handled: true };
}

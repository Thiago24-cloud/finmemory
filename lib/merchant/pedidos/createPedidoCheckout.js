import {
  getStripe,
  isStripeConnectOrdersEnabled,
  stripeAppBaseUrl,
  stripeConnectApplicationFeeCents,
} from '../../stripe/stripeClient';
import { isStoreStripeConnectReady } from '../../stripe/connectMerchant';
import { createPedidoLoja } from './createPedidoLoja';
import { PEDIDO_STATUS } from './pedidoStatus';

const CHECKOUT_META = 'pedido_retirada';

/**
 * Cria pedido pending + Stripe Checkout (Connect destination charge).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   lojaId: string,
 *   clienteUserId: string,
 *   clienteEmail: string,
 *   items: Array<{ produto_loja_id: string, quantidade?: number }>,
 *   observacao?: string | null,
 * }} input
 */
export async function createPedidoCheckout(supabase, input) {
  if (!isStripeConnectOrdersEnabled()) {
    return { ok: false, error: 'Pagamentos online indisponíveis no momento.' };
  }

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: 'Stripe não configurado.' };

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select(
      'id, name, active, needs_review, stripe_connect_account_id, stripe_connect_charges_enabled'
    )
    .eq('id', input.lojaId)
    .maybeSingle();

  if (storeErr) return { ok: false, error: storeErr.message };
  if (!store?.id) return { ok: false, error: 'Loja não encontrada.' };
  if (store.needs_review === true) {
    return { ok: false, error: 'Loja ainda em análise.' };
  }
  if (!isStoreStripeConnectReady(store)) {
    return {
      ok: false,
      error: 'Esta loja ainda não ativou pagamentos. Peça ao lojista conectar o Stripe no painel.',
      code: 'STORE_PAYMENTS_NOT_READY',
    };
  }

  const draft = await createPedidoLoja(supabase, {
    lojaId: input.lojaId,
    clienteUserId: input.clienteUserId,
    items: input.items,
    observacao: input.observacao,
    paymentStatus: 'pending',
    skipStockDecrement: true,
    skipMerchantPush: true,
  });

  if (!draft.ok) return draft;

  const pedido = draft.pedido;
  const amountCents = Math.max(50, Math.round(Number(pedido.total) * 100));
  const applicationFeeAmount = stripeConnectApplicationFeeCents(amountCents);
  const origin = stripeAppBaseUrl();

  const lineItems = (draft.itens || []).map((li) => ({
    quantity: li.quantidade,
    price_data: {
      currency: 'brl',
      unit_amount: Math.max(1, Math.round(Number(li.preco_unitario) * 100)),
      product_data: {
        name: String(li.nome).slice(0, 120),
      },
    },
  }));

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'pt-BR',
      customer_email: input.clienteEmail || undefined,
      client_reference_id: input.clienteUserId,
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount > 0 ? applicationFeeAmount : undefined,
        transfer_data: {
          destination: store.stripe_connect_account_id,
        },
        metadata: {
          pedido_id: pedido.id,
          loja_id: store.id,
        },
      },
      metadata: {
        finmemory_checkout: CHECKOUT_META,
        pedido_id: pedido.id,
        loja_id: store.id,
        cliente_user_id: input.clienteUserId,
      },
      success_url: `${origin}/pedido/${pedido.id}?paid=1`,
      cancel_url: `${origin}/mapa?pedido_cancel=${pedido.id}`,
    });

    await supabase
      .from('pedidos_loja')
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedido.id);

    return {
      ok: true,
      url: session.url,
      sessionId: session.id,
      pedido_id: pedido.id,
    };
  } catch (err) {
    await supabase
      .from('pedidos_loja')
      .update({
        payment_status: 'cancelled',
        status: PEDIDO_STATUS.CANCELADO,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedido.id);

    console.error('[createPedidoCheckout]', err?.message || err);
    return { ok: false, error: err?.message || 'Erro ao abrir pagamento.' };
  }
}

export { CHECKOUT_META };

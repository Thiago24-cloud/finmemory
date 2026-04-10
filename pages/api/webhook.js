import Stripe from 'stripe';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function syncUserFromSubscription(supabase, stripe, subscription) {
  const sub =
    typeof subscription === 'string'
      ? await stripe.subscriptions.retrieve(subscription)
      : subscription;
  const userIdMeta = sub.metadata?.user_id;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  let userId = userIdMeta;

  if (!userId && customerId) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    userId = data?.id;
  }

  if (!userId) {
    console.warn('[stripe/webhook] subscription sem user_id/metadata:', sub.id);
    return;
  }

  const status = sub.status;
  const active = status === 'active' || status === 'trialing';

  const { data: cur } = await supabase
    .from('users')
    .select('finmemory_plus_since')
    .eq('id', userId)
    .maybeSingle();

  const payload = {
    stripe_subscription_id: sub.id,
    stripe_subscription_status: status,
    finmemory_plus_active: active,
  };
  if (customerId) payload.stripe_customer_id = customerId;

  if (active && !cur?.finmemory_plus_since) {
    payload.finmemory_plus_since = new Date().toISOString();
  }

  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    payload.finmemory_plus_active = false;
  }

  const { error } = await supabase.from('users').update(payload).eq('id', userId);
  if (error) console.error('[stripe/webhook] update users:', error.message);
}

/**
 * POST /api/webhook — eventos Stripe (assinatura FinMemory Plus).
 * Painel Stripe → Webhooks → URL: {NEXT_PUBLIC_APP_URL}/api/webhook
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) {
    console.error('[stripe/webhook] STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET em falta');
    return res.status(500).send('Configuração incompleta');
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).send('Missing stripe-signature');
  }

  let buf;
  try {
    buf = await readRawBody(req);
  } catch (e) {
    return res.status(400).send(`Body: ${e.message}`);
  }

  const stripe = new Stripe(secret);
  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, whSecret);
  } catch (err) {
    console.warn('[stripe/webhook] assinatura inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).send('Supabase admin em falta');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id || session.client_reference_id;
        const subId = session.subscription;
        const custId = session.customer;
        if (userId && subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncUserFromSubscription(supabase, stripe, sub);
        } else if (userId && custId && !subId) {
          await supabase
            .from('users')
            .update({ stripe_customer_id: custId })
            .eq('id', userId);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await syncUserFromSubscription(supabase, stripe, sub);
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object;
        const customerId =
          typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
        if (customerId) {
          const { data } = await supabase
            .from('users')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          if (data?.id) {
            console.warn('[stripe/webhook] invoice.payment_failed user', data.id, inv.id);
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('[stripe/webhook] handler:', e?.message || e);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  return res.status(200).json({ received: true });
}

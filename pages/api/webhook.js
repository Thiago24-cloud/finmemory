import Stripe from 'stripe';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { planFromStripePriceId } from '../../lib/stripePlanPrice';

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

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} email
 * @param {Record<string, unknown>} fields
 */
async function syncProfilesStripeFields(supabase, email, fields) {
  const em = String(email || '').trim();
  if (!em) return;
  const { data: rows, error: qErr } = await supabase.from('profiles').select('id').eq('email', em);
  if (qErr) {
    console.warn('[stripe/webhook] profiles lookup:', qErr.message);
    return;
  }
  if (!rows?.length) return;
  for (const row of rows) {
    const { error } = await supabase.from('profiles').update(fields).eq('id', row.id);
    if (error) console.warn('[stripe/webhook] profiles update:', error.message);
  }
}

async function syncUserFromSubscription(supabase, stripe, subscription) {
  const sub =
    typeof subscription === 'string'
      ? await stripe.subscriptions.retrieve(subscription, {
          expand: ['items.data.price'],
        })
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

  const priceObj = sub.items?.data?.[0]?.price;
  const priceId = typeof priceObj === 'string' ? priceObj : priceObj?.id;
  const planFromPrice = planFromStripePriceId(priceId);
  const planMeta = String(sub.metadata?.plan || '').toLowerCase();
  let resolvedPlan = 'free';
  if (active) {
    if (planFromPrice) resolvedPlan = planFromPrice;
    else if (planMeta === 'plus' || planMeta === 'pro' || planMeta === 'familia') resolvedPlan = planMeta;
    else if (priceId) {
      console.warn('[stripe/webhook] price id sem mapeamento nas env STRIPE_*_PRICE_ID:', priceId);
      resolvedPlan = 'plus';
    }
  }

  const { data: cur } = await supabase
    .from('users')
    .select('finmemory_plus_since, email')
    .eq('id', userId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const payload = {
    stripe_subscription_id: sub.id,
    stripe_subscription_status: status,
    finmemory_plus_active: active && resolvedPlan !== 'free',
    plano: resolvedPlan,
    plano_ativo: active && resolvedPlan !== 'free',
    plano_atualizado_em: nowIso,
  };
  if (customerId) payload.stripe_customer_id = customerId;

  if (active && !cur?.finmemory_plus_since && resolvedPlan !== 'free') {
    payload.finmemory_plus_since = nowIso;
  }

  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    payload.finmemory_plus_active = false;
    payload.plano = 'free';
    payload.plano_ativo = false;
  }

  const { error } = await supabase.from('users').update(payload).eq('id', userId);
  if (error) console.error('[stripe/webhook] update users:', error.message);

  const profileFields = {
    stripe_customer_id: customerId || null,
    stripe_subscription_id: sub.id,
    plano: payload.plano,
    plano_ativo: payload.plano_ativo,
    plano_atualizado_em: nowIso,
  };
  if (cur?.email) await syncProfilesStripeFields(supabase, cur.email, profileFields);
}

/**
 * POST /api/webhook — eventos Stripe (assinaturas Plus / Pro / Família).
 * Stripe → Webhooks → URL: https://finmemory.com.br/api/webhook
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
          const sub = await stripe.subscriptions.retrieve(subId, {
            expand: ['items.data.price'],
          });
          await syncUserFromSubscription(supabase, stripe, sub);
        } else if (userId && custId && !subId) {
          await supabase.from('users').update({ stripe_customer_id: custId }).eq('id', userId);
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

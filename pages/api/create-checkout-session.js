import Stripe from 'stripe';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { checkoutPlanOrDefault, stripePriceIdsFromEnv } from '../../lib/stripePlanPrice';
import { stripeAppBaseUrl } from '../../lib/stripe/appBaseUrl';
import { getStripeCheckoutDiagnostics } from '../../lib/stripe/checkoutDiagnostics';

function parsePlanFromBody(req) {
  if (typeof req.body === 'object' && req.body !== null && req.body.plan != null) {
    return req.body.plan;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      const parsed = JSON.parse(req.body);
      return parsed?.plan;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * POST /api/create-checkout-session
 * Body JSON opcional: { "plan": "pro" | "familia" | "enterprise" } (default pro).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const diag = getStripeCheckoutDiagnostics();
  if (!diag.checks.secret) {
    return res.status(503).json({
      error: 'Pagamentos temporariamente indisponíveis (Stripe não configurado no servidor).',
      issues: diag.issues,
    });
  }

  const plan = checkoutPlanOrDefault(parsePlanFromBody(req));
  const prices = stripePriceIdsFromEnv();
  const priceId = prices[plan];
  if (!priceId) {
    return res.status(503).json({
      error: `Plano "${plan}" sem Price ID no servidor. Configure STRIPE_${plan.toUpperCase()}_PRICE_ID no Cloud Run.`,
      issues: diag.issues,
    });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  const email = session?.user?.email;
  if (!userId || !email) {
    return res.status(401).json({
      error: 'Faça login para assinar um plano FinMemory.',
      code: 'auth_required',
    });
  }

  const origin = stripeAppBaseUrl();
  if (!origin) {
    return res.status(503).json({
      error: 'URL do app não configurada. Defina NEXT_PUBLIC_APP_URL=https://finmemory.com.br no servidor.',
      issues: diag.issues,
    });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase admin não configurado.' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim());

  try {
    let price;
    try {
      price = await stripe.prices.retrieve(priceId);
    } catch (priceErr) {
      console.error('[stripe/create-checkout-session] price retrieve:', priceId, priceErr?.message);
      return res.status(503).json({
        error:
          'Preço do plano inválido no Stripe. Verifique STRIPE_*_PRICE_ID no Cloud Run (modo live/teste igual à STRIPE_SECRET_KEY).',
        code: 'invalid_price_id',
      });
    }
    if (!price.active) {
      return res.status(503).json({
        error: 'Este plano está inativo no Stripe. Ative o preço no Dashboard Stripe → Produtos.',
        code: 'price_inactive',
      });
    }

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, email, stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();

    if (userErr || !userRow) {
      return res.status(404).json({
        error: 'Conta não encontrada. Saia e entre novamente, ou contacte o suporte.',
        code: 'user_not_found',
      });
    }

    let customerId = userRow.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userRow.email || email,
        metadata: { user_id: userId },
        preferred_locales: ['pt-BR'],
      });
      customerId = customer.id;
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', userId);
    }

    const successUrl = `${origin}/settings?stripe=success&plan=${encodeURIComponent(plan)}`;
    const cancelUrl = `${origin}/planos?stripe=cancel`;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      locale: 'pt-BR',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { user_id: userId, plan },
      subscription_data: {
        metadata: { user_id: userId, plan },
      },
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
    });

    if (!checkoutSession.url) {
      return res.status(500).json({
        error: 'Stripe não devolveu URL de pagamento. Tente novamente em instantes.',
        code: 'no_checkout_url',
      });
    }

    return res.status(200).json({ url: checkoutSession.url, sessionId: checkoutSession.id });
  } catch (e) {
    console.error('[stripe/create-checkout-session]', e?.message || e);
    const msg = e?.message || 'Erro ao criar checkout.';
    const hint =
      msg.includes('No such price') || msg.includes('resource_missing')
        ? ' Price ID não existe na conta Stripe desta STRIPE_SECRET_KEY.'
        : '';
    return res.status(500).json({ error: msg + hint, code: 'stripe_error' });
  }
}

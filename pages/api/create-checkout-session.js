import Stripe from 'stripe';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { checkoutPlanOrDefault, stripePriceIdsFromEnv } from '../../lib/stripePlanPrice';
import { stripeAppBaseUrl } from '../../lib/stripe/appBaseUrl';
import { getStripeCheckoutDiagnostics } from '../../lib/stripe/checkoutDiagnostics';
import { resolvePublicUserId } from '../../lib/resolvePublicUserId';
import { ensureStripePricePurchasable } from '../../lib/stripe/ensurePricePurchasable';

function parseJsonBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function parsePlanFromBody(req) {
  const body = parseJsonBody(req);
  return body?.plan;
}

function parseUiModeFromBody(req) {
  const body = parseJsonBody(req);
  return body?.uiMode === 'embedded' ? 'embedded' : 'hosted';
}

/**
 * POST /api/create-checkout-session
 * Body JSON opcional: { "plan": "pro" | "familia" | "enterprise" } (default pro).
 * Enterprise não aparece em /planos — use link direto /checkout?plan=enterprise ou POST com plan=enterprise.
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
  const uiMode = parseUiModeFromBody(req);
  const prices = stripePriceIdsFromEnv();
  const priceId = prices[plan];
  if (!priceId) {
    return res.status(503).json({
      error: `Plano "${plan}" sem Price ID no servidor. Configure STRIPE_${plan.toUpperCase()}_PRICE_ID no Cloud Run.`,
      issues: diag.issues,
    });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) {
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

  const userId = await resolvePublicUserId(session, supabase);
  if (!userId) {
    return res.status(401).json({
      error: 'Conta não encontrada. Saia e entre novamente.',
      code: 'user_not_found',
    });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim());

  try {
    try {
      await ensureStripePricePurchasable(stripe, priceId);
    } catch (catalogErr) {
      console.error('[stripe/create-checkout-session] catalog:', priceId, catalogErr?.message);
      if (catalogErr?.code === 'price_inactive' || catalogErr?.code === 'product_inactive') {
        return res.status(503).json({
          error: catalogErr.message,
          code: catalogErr.code,
        });
      }
      return res.status(503).json({
        error:
          'Preço do plano inválido no Stripe. Verifique STRIPE_*_PRICE_ID no Cloud Run (modo live/teste igual à STRIPE_SECRET_KEY).',
        code: 'invalid_price_id',
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

    const returnUrl = `${origin}/settings?stripe=success&plan=${encodeURIComponent(plan)}&session_id={CHECKOUT_SESSION_ID}`;
    const successUrl = `${origin}/settings?stripe=success&plan=${encodeURIComponent(plan)}`;
    const cancelUrl =
      plan === 'enterprise' ? `${origin}/settings?stripe=cancel` : `${origin}/planos?stripe=cancel`;

    const sessionBase = {
      mode: 'subscription',
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      locale: 'pt-BR',
      metadata: { user_id: userId, plan },
      subscription_data: {
        metadata: { user_id: userId, plan },
      },
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      /** Evita botão Link a piscar/relayout no Checkout hospedado. */
      wallet_options: {
        link: { display: 'never' },
      },
    };

    const openCheckout = async () => {
      if (uiMode === 'embedded') {
        const checkoutSession = await stripe.checkout.sessions.create({
          ...sessionBase,
          ui_mode: 'embedded',
          redirect_on_completion: 'if_required',
          return_url: returnUrl,
        });
        if (!checkoutSession.client_secret) {
          const err = new Error('Stripe não devolveu sessão de pagamento. Tente novamente.');
          err.code = 'no_client_secret';
          throw err;
        }
        return {
          clientSecret: checkoutSession.client_secret,
          sessionId: checkoutSession.id,
          uiMode: 'embedded',
        };
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        ...sessionBase,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      if (!checkoutSession.url) {
        const err = new Error('Stripe não devolveu URL de pagamento. Tente novamente em instantes.');
        err.code = 'no_checkout_url';
        throw err;
      }
      return {
        url: checkoutSession.url,
        sessionId: checkoutSession.id,
        uiMode: 'hosted',
      };
    };

    try {
      return res.status(200).json(await openCheckout());
    } catch (sessionErr) {
      if (!/product is not active/i.test(String(sessionErr?.message || ''))) {
        throw sessionErr;
      }
      await ensureStripePricePurchasable(stripe, priceId);
      return res.status(200).json(await openCheckout());
    }
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

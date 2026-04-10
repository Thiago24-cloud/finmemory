import Stripe from 'stripe';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    ''
  ).replace(/\/$/, '');
}

/**
 * POST /api/create-checkout-session
 * Cria sessão Stripe Checkout (assinatura FinMemory Plus). Utilizador vem da sessão NextAuth.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PLUS_PRICE_ID || process.env.STRIPE_PRICE_ID;
  if (!secret || !priceId) {
    return res.status(500).json({ error: 'Stripe não configurado no servidor.' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  const email = session?.user?.email;
  if (!userId || !email) {
    return res.status(401).json({ error: 'Faça login para assinar o FinMemory Plus.' });
  }

  const origin = baseUrl();
  if (!origin) {
    return res.status(500).json({ error: 'Defina NEXT_PUBLIC_APP_URL ou NEXTAUTH_URL.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase admin não configurado.' });
  }

  const stripe = new Stripe(secret);

  try {
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, email, stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();

    if (userErr || !userRow) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    let customerId = userRow.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userRow.email || email,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', userId);
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      locale: 'pt-BR',
      success_url: `${origin}/dashboard?stripe=success`,
      cancel_url: `${origin}/dashboard?stripe=cancel`,
      metadata: { user_id: userId },
      subscription_data: {
        metadata: { user_id: userId },
      },
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: checkoutSession.url, sessionId: checkoutSession.id });
  } catch (e) {
    console.error('[stripe/create-checkout-session]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Erro ao criar checkout.' });
  }
}

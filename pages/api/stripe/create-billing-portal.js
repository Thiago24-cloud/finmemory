import Stripe from 'stripe';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

function appBaseUrl() {
  return (
    process.env.STRIPE_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    ''
  ).replace(/\/$/, '');
}

/**
 * POST /api/stripe/create-billing-portal
 * Cria sessão do portal de cobrança Stripe para o utilizador logado.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'Stripe não configurado' });
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) return res.status(401).json({ error: 'Não autenticado' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase admin não configurado' });

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id,stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();
  if (userErr || !userRow) return res.status(404).json({ error: 'Utilizador não encontrado' });
  const customerId = String(userRow.stripe_customer_id || '').trim();
  if (!customerId) return res.status(400).json({ error: 'Conta sem cliente Stripe vinculado' });
  const returnUrl = `${appBaseUrl() || 'https://finmemory.com.br'}/settings`;
  try {
    const stripe = new Stripe(secret);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return res.status(200).json({ ok: true, url: portal.url });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Falha ao abrir portal Stripe' });
  }
}

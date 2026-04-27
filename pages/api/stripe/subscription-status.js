import Stripe from 'stripe';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

/**
 * GET /api/stripe/subscription-status
 * Retorna status atual da assinatura Stripe do utilizador logado.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'Stripe não configurado' });
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) return res.status(401).json({ error: 'Não autenticado' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase admin não configurado' });

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id,plano,plano_ativo,stripe_customer_id,stripe_subscription_status')
    .eq('id', userId)
    .maybeSingle();
  if (userErr || !userRow) return res.status(404).json({ error: 'Utilizador não encontrado' });

  const out = {
    plano: String(userRow.plano || 'free').toLowerCase(),
    plano_ativo: Boolean(userRow.plano_ativo),
    stripe_subscription_status: String(userRow.stripe_subscription_status || ''),
    next_billing_at: null,
    cancel_at_period_end: false,
  };

  const customerId = String(userRow.stripe_customer_id || '').trim();
  if (!customerId) return res.status(200).json({ ok: true, ...out });

  const stripe = new Stripe(secret);
  try {
    const list = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 5,
    });
    const preferred =
      list.data.find((s) => ['active', 'trialing', 'past_due'].includes(String(s.status || ''))) || list.data[0];
    if (preferred) {
      out.stripe_subscription_status = String(preferred.status || out.stripe_subscription_status || '');
      out.cancel_at_period_end = Boolean(preferred.cancel_at_period_end);
      const periodEnd = Number(preferred.current_period_end || 0);
      out.next_billing_at = periodEnd > 0 ? new Date(periodEnd * 1000).toISOString() : null;
    }
  } catch (e) {
    console.warn('[stripe/subscription-status]', e?.message || e);
  }
  return res.status(200).json({ ok: true, ...out });
}

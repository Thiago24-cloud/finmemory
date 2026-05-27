import Stripe from 'stripe';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { planFromStripePriceId } from '../../../lib/stripePlanPrice';

function resolvePlanFromSubscription(sub) {
  const status = String(sub?.status || '').toLowerCase();
  const active = status === 'active' || status === 'trialing';
  if (!active) return { plan: 'free', active: false, status };
  const priceObj = sub?.items?.data?.[0]?.price;
  const priceId = typeof priceObj === 'string' ? priceObj : priceObj?.id;
  const mapped = planFromStripePriceId(priceId);
  const planMeta = String(sub?.metadata?.plan || '').toLowerCase();
  const normalizedMeta = planMeta === 'família' ? 'familia' : planMeta;
  const plan = mapped || (['pro', 'familia', 'enterprise'].includes(normalizedMeta) ? normalizedMeta : 'pro');
  return { plan, active: true, status };
}

/**
 * POST /api/stripe/sync-plan-status
 * Revalida o plano do utilizador logado após retorno do checkout.
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
  const stripe = new Stripe(secret);

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id,email,stripe_customer_id,plano,plano_ativo')
    .eq('id', userId)
    .maybeSingle();
  if (userErr || !userRow) return res.status(404).json({ error: 'Utilizador não encontrado' });

  let finalPlan = String(userRow.plano || 'free').toLowerCase();
  let finalActive = Boolean(userRow.plano_ativo);
  let stripeStatus = null;
  const customerId = String(userRow.stripe_customer_id || '').trim();
  if (customerId) {
    const list = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 5,
      expand: ['data.items.data.price'],
    });
    const preferred =
      list.data.find((s) => ['active', 'trialing', 'past_due'].includes(String(s.status || ''))) || list.data[0];
    if (preferred) {
      const resolved = resolvePlanFromSubscription(preferred);
      stripeStatus = resolved.status;
      finalPlan = resolved.plan;
      finalActive = resolved.active;
      const nowIso = new Date().toISOString();
      await supabase
        .from('users')
        .update({
          stripe_subscription_id: preferred.id,
          stripe_subscription_status: resolved.status,
          finmemory_plus_active: resolved.active && resolved.plan !== 'free',
          plano: resolved.plan,
          plano_ativo: resolved.active && resolved.plan !== 'free',
          plano_atualizado_em: nowIso,
        })
        .eq('id', userId);
    }
  }

  return res.status(200).json({
    ok: true,
    plano: finalPlan,
    plano_ativo: finalActive,
    stripe_subscription_status: stripeStatus,
  });
}

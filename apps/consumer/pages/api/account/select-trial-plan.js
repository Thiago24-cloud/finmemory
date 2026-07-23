/**
 * POST /api/account/select-trial-plan
 * Body: { audience: 'consumer'|'merchant', plan: string }
 * Persiste preferência + trial local (sem Stripe).
 */
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import {
  CONSUMER_TRIAL_DAYS,
  isConsumerPlanId,
  isMerchantPlanId,
  resolveAppHomePath,
} from '../../../lib/productPlansCatalog';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) return res.status(401).json({ error: 'Faça login.' });

  const audience = String(req.body?.audience || '').toLowerCase();
  const plan = String(req.body?.plan || '').toLowerCase();

  if (audience === 'consumer' && !isConsumerPlanId(plan)) {
    return res.status(400).json({ error: 'Plano consumidor inválido.' });
  }
  if (audience === 'merchant' && !isMerchantPlanId(plan)) {
    return res.status(400).json({ error: 'Plano lojista inválido.' });
  }
  if (audience !== 'consumer' && audience !== 'merchant') {
    return res.status(400).json({ error: 'Informe audience consumer ou merchant.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + CONSUMER_TRIAL_DAYS);
  const trialIso = trialEnds.toISOString();

  const patch = {
    preferred_audience: audience,
    preferred_plan: plan,
    plan_trial_ends_at: trialIso,
  };

  const { error } = await supabase.from('users').update(patch).eq('id', userId);
  if (error) {
    console.warn('[select-trial-plan]', error.message);
    if (/preferred_audience|plan_trial_ends_at|column/i.test(error.message || '')) {
      return res.status(503).json({
        error:
          'Rode a migration 20260723180000_users_plan_preference.sql no Supabase para ativar a escolha de planos.',
      });
    }
    return res.status(500).json({ error: 'Não foi possível salvar o plano.' });
  }

  const home = resolveAppHomePath({
    preferred_audience: audience,
    preferred_plan: plan,
    plan_trial_ends_at: trialIso,
  });

  return res.status(200).json({
    ok: true,
    preferred_audience: audience,
    preferred_plan: plan,
    plan_trial_ends_at: trialIso,
    home,
  });
}

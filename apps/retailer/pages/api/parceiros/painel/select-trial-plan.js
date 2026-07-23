/**
 * POST /api/parceiros/painel/select-trial-plan
 * Body: { plan_code }
 * Aplica/troca plano B2B em trial (hub /inicio).
 */
import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import {
  STORE_PLAN_CODES,
  ensureStoreSubscription,
  getRestaurantPlan,
} from '../../../../lib/merchant/storePlans';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const planCode = String(req.body?.plan_code || req.body?.plan || '').toLowerCase();
  if (!STORE_PLAN_CODES.includes(planCode)) {
    return res.status(400).json({ error: 'Plano lojista inválido.', plans: STORE_PLAN_CODES });
  }

  const storeId = auth.store?.id;
  if (!storeId) {
    return res.status(400).json({ error: 'Loja não encontrada para este usuário.' });
  }

  await ensureStoreSubscription(auth.supabase, storeId, {
    planCode,
    forcePlan: true,
  });

  const plan = await getRestaurantPlan(auth.supabase, storeId);
  return res.status(200).json({ ok: true, plan });
}

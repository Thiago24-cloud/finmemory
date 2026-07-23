import { requireMerchantApi } from '../../../lib/merchant/requireMerchantApi';
import { requireFeature } from '../../../lib/merchant/requireFeature';
import { computeTrialReport } from '../../../lib/merchant/trialValidation/computeTrialReport';

/**
 * GET  /api/merchant/trial-report — métricas de validação do trial
 * PATCH /api/merchant/trial-report — { willing_to_pay, validation_notes }
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;
  if (!(await requireFeature(auth, res, 'reports'))) return;

  const { supabase, store } = auth;

  if (req.method === 'GET') {
    const mock = req.query.mock === '1' || req.query.mock === 'true';
    const report = await computeTrialReport(supabase, store.id, {
      from: req.query.from ? String(req.query.from) : undefined,
      to: req.query.to ? String(req.query.to) : undefined,
      mock,
    });
    return res.status(200).json(report);
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (typeof body.willing_to_pay === 'boolean') {
      patch.willing_to_pay = body.willing_to_pay;
    }
    if (body.validation_notes != null) {
      patch.validation_notes = String(body.validation_notes).slice(0, 2000);
    }

    const { data, error } = await supabase
      .from('store_subscriptions')
      .update(patch)
      .eq('store_id', store.id)
      .select('willing_to_pay, validation_notes')
      .maybeSingle();

    if (error) {
      if (/willing_to_pay|validation_notes/i.test(error.message || '')) {
        return res.status(503).json({
          code: 'MISSING_SCHEMA',
          error: 'Execute a migration 20260723160000_trial_validation_feedback.sql.',
        });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      ok: true,
      willing_to_pay: data?.willing_to_pay ?? null,
      validation_notes: data?.validation_notes ?? null,
    });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}

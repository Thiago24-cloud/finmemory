import { requireAdminCreditsApi } from '../../../lib/credits/requireCreditsApi';
import { createCampaign, listCampaigns } from '../../../lib/credits/campaignService';

export default async function handler(req, res) {
  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  if (req.method === 'GET') {
    try {
      const status = req.query.status ? String(req.query.status) : undefined;
      const campaigns = await listCampaigns(ctx.supabase, { status });
      return res.status(200).json({ campaigns });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const campaign = await createCampaign(ctx.supabase, {
        name: body.name,
        partner_name: body.partner_name,
        product_name: body.product_name,
        product_brand: body.product_brand,
        product_identifier: body.product_identifier,
        reward_amount: body.reward_amount,
        budget_total: body.budget_total,
        region: body.region,
        starts_at: body.starts_at,
        ends_at: body.ends_at,
        status: body.status || 'draft',
        rules: body.rules,
      });
      return res.status(201).json({ campaign });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

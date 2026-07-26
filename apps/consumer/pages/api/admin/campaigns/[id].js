import { requireAdminCreditsApi } from '../../../../lib/credits/requireCreditsApi';
import { getCampaignById, updateCampaignStatus } from '../../../../lib/credits/campaignService';

export default async function handler(req, res) {
  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'id obrigatório' });

  if (req.method === 'GET') {
    try {
      const campaign = await getCampaignById(ctx.supabase, id);
      if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
      return res.status(200).json({ campaign });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const status = String(req.body?.status || '').trim();
      if (!status) return res.status(400).json({ error: 'status obrigatório' });
      const campaign = await updateCampaignStatus(ctx.supabase, id, status);
      return res.status(200).json({ campaign });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}

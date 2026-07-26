import { requireAdminCreditsApi } from '../../../../../lib/credits/requireCreditsApi';
import { listCampaigns } from '../../../../../lib/credits/campaignService';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  try {
    const { supabase } = ctx;

    const [merchantsRes, activeCampaigns, allCampaigns, creditRes, recentTxsRes, validationsRes] =
      await Promise.all([
        supabase.from('stores').select('id', { count: 'exact', head: true }),
        listCampaigns(supabase, { status: 'active' }),
        listCampaigns(supabase),
        supabase.from('fm_ledger_transactions').select('amount, type').eq('status', 'confirmed'),
        supabase
          .from('fm_ledger_transactions')
          .select('*')
          .eq('status', 'confirmed')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('fm_purchase_validations').select('id', { count: 'exact', head: true }),
      ]);

    const totalCredit = (creditRes.data || []).reduce(
      (sum, row) => sum + (Number(row.amount) > 0 ? Number(row.amount) : 0),
      0
    );

    let totalValidations = validationsRes.count ?? 0;
    if (validationsRes.error) {
      totalValidations = (creditRes.data || []).filter((tx) => tx.type === 'campaign_reward').length;
    }

    return res.status(200).json({
      total_merchants: merchantsRes.count ?? 0,
      active_campaigns: activeCampaigns.length,
      total_credit_issued: Math.round(totalCredit * 100) / 100,
      total_validations: totalValidations,
      recent_transactions: (recentTxsRes.data || []).map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount),
        status: tx.status,
        description: tx.description,
        blockchain_tx_hash: tx.blockchain_tx_hash,
        created_at: tx.created_at,
      })),
      campaigns_budget_usage: activeCampaigns.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        budget_total: Number(c.budget_total),
        budget_spent: Number(c.budget_spent),
        reward_amount: Number(c.reward_amount),
      })),
      all_campaigns_count: allCampaigns.length,
    });
  } catch (err) {
    console.warn('[adm/bridge/dashboard]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

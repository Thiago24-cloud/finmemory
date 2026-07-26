import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { listCampaigns } from '../../../lib/credits/campaignService';
import { getWalletWithTransactions } from '../../../lib/credits/walletService';
import { shouldMockBlockchainAudit } from '../../../lib/credits/blockchainAudit';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado' });

  try {
    const demoEmail = String(req.query.email || process.env.FM_DEMO_USER_EMAIL || '').trim();

    let demoUser = null;
    if (demoEmail) {
      const { data } = await supabase
        .from('users')
        .select('id, email, name')
        .ilike('email', demoEmail)
        .maybeSingle();
      demoUser = data;
    }

    if (!demoUser) {
      const { data } = await supabase
        .from('users')
        .select('id, email, name')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      demoUser = data;
    }

    const campaigns = await listCampaigns(supabase, { status: 'active' });
    const allCampaigns = await listCampaigns(supabase);

    let wallet = null;
    let transactions = [];
    if (demoUser?.id) {
      const w = await getWalletWithTransactions(supabase, demoUser.id, { limit: 10 });
      wallet = w.wallet;
      transactions = w.transactions;
    }

    const { count: priceCount } = await supabase
      .from('price_points')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

    return res.status(200).json({
      demo_user: demoUser,
      wallet,
      transactions,
      active_campaigns: campaigns,
      all_campaigns: allCampaigns,
      map_stats: {
        price_points_last_7d: priceCount ?? 0,
      },
      blockchain_audit_mock: shouldMockBlockchainAudit(),
    });
  } catch (err) {
    console.warn('[demo/investor]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

import { requireAdminCreditsApi } from '../../../../../lib/credits/requireCreditsApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  try {
    const q = String(req.query.q || '').trim();
    let query = ctx.supabase
      .from('users')
      .select('id, email, name, account_type, created_at')
      .order('created_at', { ascending: false })
      .limit(40);
    if (q.length >= 2) {
      query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return res.status(200).json({ users: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

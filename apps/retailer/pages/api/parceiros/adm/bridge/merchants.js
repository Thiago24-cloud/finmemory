import { requireAdminCreditsApi } from '../../../../../lib/credits/requireCreditsApi';

/**
 * GET /api/parceiros/adm/bridge/merchants?q=
 * Lista comerciantes (users) com loja vinculada para operar o Bridge MVP.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  try {
    const q = String(req.query.q || '').trim();
    let userQuery = ctx.supabase
      .from('users')
      .select('id, email, name, account_type, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (q.length >= 2) {
      userQuery = userQuery.or(`email.ilike.%${q}%,name.ilike.%${q}%`);
    }

    const { data: users, error: usersErr } = await userQuery;
    if (usersErr) throw new Error(usersErr.message);

    const userIds = (users || []).map((u) => u.id).filter(Boolean);
    if (userIds.length === 0) {
      return res.status(200).json({ merchants: [] });
    }

    const { data: stores, error: storesErr } = await ctx.supabase
      .from('stores')
      .select('id, name, owner_user_id, cnpj, type, active')
      .in('owner_user_id', userIds);

    if (storesErr && !String(storesErr.message || '').includes('owner_user_id')) {
      throw new Error(storesErr.message);
    }

    const storesByOwner = new Map();
    for (const store of stores || []) {
      if (store.owner_user_id) storesByOwner.set(store.owner_user_id, store);
    }

    const merchants = (users || [])
      .map((user) => {
        const store = storesByOwner.get(user.id);
        if (!store) return null;
        return {
          user_id: user.id,
          email: user.email,
          name: user.name,
          store_id: store.id,
          store_name: store.name,
          store_cnpj: store.cnpj,
          store_type: store.type,
          store_active: store.active,
        };
      })
      .filter(Boolean);

    return res.status(200).json({ merchants });
  } catch (err) {
    console.warn('[adm/bridge/merchants]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

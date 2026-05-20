import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { isFinmemoryAdminEmail } from '../../../lib/adminAccess';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

/**
 * GET  — lojas parceiras (filtro ?needs_review=1)
 * PATCH — { storeId, needs_review?: boolean, active?: boolean }
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email || !isFinmemoryAdminEmail(email)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  if (req.method === 'GET') {
    const onlyReview =
      req.query.needs_review === '1' ||
      req.query.needs_review === 'true';

    let q = supabase
      .from('stores')
      .select('id, name, address, lat, lng, active, needs_review, owner_user_id, cnpj, type')
      .not('owner_user_id', 'is', null)
      .order('name', { ascending: true })
      .limit(80);

    if (onlyReview) {
      q = q.eq('needs_review', true);
    }

    const { data, error } = await q;
    if (error) {
      console.warn('[admin/partner-stores] list:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ stores: data || [] });
  }

  if (req.method === 'PATCH') {
    const storeId = String(req.body?.storeId || '').trim();
    if (!storeId) {
      return res.status(400).json({ error: 'Informe storeId.' });
    }

    const patch = { updated_at: new Date().toISOString() };
    if (typeof req.body?.needs_review === 'boolean') {
      patch.needs_review = req.body.needs_review;
    }
    if (typeof req.body?.active === 'boolean') {
      patch.active = req.body.active;
    }

    if (Object.keys(patch).length === 1) {
      return res.status(400).json({ error: 'Nada para atualizar (needs_review ou active).' });
    }

    const { data, error } = await supabase
      .from('stores')
      .update(patch)
      .eq('id', storeId)
      .not('owner_user_id', 'is', null)
      .select('id, name, needs_review, active')
      .maybeSingle();

    if (error) {
      console.warn('[admin/partner-stores] patch:', error.message);
      return res.status(500).json({ error: error.message });
    }
    if (!data) {
      return res.status(404).json({ error: 'Loja parceira não encontrada.' });
    }

    return res.status(200).json({ store: data });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}

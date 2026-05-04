import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccess } from '../../../lib/access-server';
import { canAccessAdminRoutes } from '../../../lib/adminAccess';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

const SELECT_FIELDS =
  'id,email,name,created_at,plano,plano_ativo,plano_atualizado_em,stripe_customer_id,stripe_subscription_id,stripe_subscription_status,finmemory_plus_active,finmemory_plus_since';

async function checkAdmin(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    res.status(401).json({ error: 'Não autenticado' });
    return null;
  }
  const allowed = await canAccessAdminRoutes(session.user.email, () => canAccess(session.user.email));
  if (!allowed) {
    res.status(403).json({ error: 'Acesso negado' });
    return null;
  }
  return session;
}

/**
 * GET /api/admin/financeiro
 * Cruzamento só leitura: utilizadores com cliente Stripe e/ou plano pago vs campos de plano na BD.
 *
 * Query:
 * - scope=pagantes (default): stripe_customer_id não nulo
 * - scope=plano: plano_ativo ou plano != free ou finmemory_plus_active
 * - scope=todos: todos os utilizadores (limit mais baixo)
 * - limit: 10–800 (default 400)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await checkAdmin(req, res);
  if (!session) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase admin não configurado' });

  const scope = String(req.query?.scope || 'pagantes').toLowerCase();
  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(800, Math.max(10, Math.floor(limitRaw)))
    : scope === 'todos'
      ? 300
      : 400;

  let q = supabase.from('users').select(SELECT_FIELDS);

  if (scope === 'pagantes') {
    q = q.not('stripe_customer_id', 'is', null);
  } else if (scope === 'plano') {
    q = q.or('plano_ativo.eq.true,finmemory_plus_active.eq.true,plano.neq.free,stripe_customer_id.not.is.null');
  } else if (scope === 'todos') {
    // sem filtro extra
  } else {
    return res.status(400).json({ error: 'scope inválido: use pagantes, plano ou todos' });
  }

  const { data: rows, error } = await q
    .order('plano_atualizado_em', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });

  const list = Array.isArray(rows) ? rows : [];
  let comStripe = 0;
  let planoAtivo = 0;
  let possivelInconsistencia = 0;

  for (const r of list) {
    const hasStripe = Boolean(String(r?.stripe_customer_id || '').trim());
    const active = Boolean(r?.plano_ativo);
    const plan = String(r?.plano || 'free').toLowerCase();
    if (hasStripe) comStripe += 1;
    if (active) planoAtivo += 1;
    if (hasStripe && !active && plan === 'free') possivelInconsistencia += 1;
  }

  return res.status(200).json({
    ok: true,
    scope,
    limit,
    count: list.length,
    summary: {
      com_stripe_customer: comStripe,
      plano_ativo_true: planoAtivo,
      stripe_mas_plano_free_inativo: possivelInconsistencia,
    },
    rows: list,
  });
}

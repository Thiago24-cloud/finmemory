import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

const STATES_META = [
  { id: 'SP', name: 'São Paulo',          needed: 50,  unlocked: true  },
  { id: 'RJ', name: 'Rio de Janeiro',     needed: 500, unlocked: false },
  { id: 'MG', name: 'Minas Gerais',       needed: 500, unlocked: false },
  { id: 'PR', name: 'Paraná',             needed: 500, unlocked: false },
  { id: 'RS', name: 'Rio Grande do Sul',  needed: 500, unlocked: false },
  { id: 'BA', name: 'Bahia',              needed: 500, unlocked: false },
  { id: 'SC', name: 'Santa Catarina',     needed: 500, unlocked: false },
];

/**
 * GET /api/map/states-progress
 * Retorna o total de usuários e progresso por estado para o painel de desbloqueio.
 * Usa a contagem real de `public.users`; SP já é desbloqueado por padrão.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  // Conta total de usuários ativos (all states share the same pool for now)
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const total = Number(totalUsers) || 0;

  const states = STATES_META.map((s) => {
    if (s.unlocked) {
      return { ...s, users: total, progress_pct: 100 };
    }
    const pct = Math.min(100, Math.round((total / s.needed) * 100));
    return { ...s, users: total, progress_pct: pct, unlocked: pct >= 100 };
  });

  return res.status(200).json({ states, total_users: total });
}

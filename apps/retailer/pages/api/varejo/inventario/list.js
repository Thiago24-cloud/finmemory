import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { normalizeAccountType, ACCOUNT_TYPE_VAREJISTA } from '../../../../lib/userType';

/**
 * GET /api/varejo/inventario/list?limit=30
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!session?.user?.email || !userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const { data: userRow } = await supabase
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .maybeSingle();

  if (normalizeAccountType(userRow?.account_type) !== ACCOUNT_TYPE_VAREJISTA) {
    return res.status(403).json({ error: 'Disponível apenas para contas varejista' });
  }

  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));

  const { data, error } = await supabase
    .from('historico_inventario_varejo')
    .select('id, nome_lote, total_itens, valor_total, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    lotes: (data || []).map((row) => ({
      ...row,
      valor_total: Number(row.valor_total),
    })),
  });
}

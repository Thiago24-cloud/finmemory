import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { normalizeAccountType, ACCOUNT_TYPE_VAREJISTA } from '../../../../lib/userType';

/**
 * GET /api/varejo/inventario/:id — lote + itens (export CSV).
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

  const loteId = req.query.id;
  if (!loteId || typeof loteId !== 'string') {
    return res.status(400).json({ error: 'id obrigatório' });
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

  const { data: lote, error: loteErr } = await supabase
    .from('historico_inventario_varejo')
    .select('id, nome_lote, total_itens, valor_total, created_at, user_id')
    .eq('id', loteId)
    .maybeSingle();

  if (loteErr) return res.status(500).json({ error: loteErr.message });
  if (!lote || lote.user_id !== userId) {
    return res.status(404).json({ error: 'Lote não encontrado' });
  }

  const { data: itens, error: itemsErr } = await supabase
    .from('historico_inventario_varejo_itens')
    .select('ean, nome, quantidade, preco_unitario, sort_order')
    .eq('lote_id', loteId)
    .order('sort_order', { ascending: true });

  if (itemsErr) return res.status(500).json({ error: itemsErr.message });

  return res.status(200).json({
    lote: {
      id: lote.id,
      nome_lote: lote.nome_lote,
      total_itens: lote.total_itens,
      valor_total: Number(lote.valor_total),
      created_at: lote.created_at,
    },
    itens: (itens || []).map((row) => ({
      ean: row.ean,
      nome: row.nome,
      quantidade: Number(row.quantidade),
      preco:
        row.preco_unitario != null && Number.isFinite(Number(row.preco_unitario))
          ? Number(row.preco_unitario)
          : null,
    })),
  });
}

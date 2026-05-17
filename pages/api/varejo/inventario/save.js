import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { normalizeAccountType, ACCOUNT_TYPE_VAREJISTA } from '../../../../lib/userType';

/**
 * POST /api/varejo/inventario/save
 * Body: { nome_lote?: string, itens: [{ ean, nome, quantidade?, preco? }] }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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

  const accountType = normalizeAccountType(
    userRow?.account_type ?? session.user.account_type
  );
  if (accountType !== ACCOUNT_TYPE_VAREJISTA) {
    return res.status(403).json({ error: 'Disponível apenas para contas varejista' });
  }

  const { nome_lote, itens } = req.body || {};
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'itens obrigatório (array não vazio)' });
  }

  const lines = itens
    .map((row, idx) => {
      const ean = String(row?.ean || row?.gtin || '').replace(/\D/g, '');
      if (!ean) return null;
      const q = Number(row?.quantidade ?? 1);
      const quantidade = Number.isFinite(q) && q > 0 ? q : 1;
      const p = row?.preco != null ? Number(row.preco) : row?.preco_unitario != null ? Number(row.preco_unitario) : null;
      const preco_unitario = p != null && Number.isFinite(p) ? p : null;
      const nome = String(row?.nome || 'Produto').trim().slice(0, 500);
      return { ean, nome, quantidade, preco_unitario, sort_order: idx };
    })
    .filter(Boolean);

  if (lines.length === 0) {
    return res.status(400).json({ error: 'Nenhum item válido' });
  }

  let valorTotal = 0;
  for (const line of lines) {
    if (line.preco_unitario != null) {
      valorTotal += line.preco_unitario * line.quantidade;
    }
  }
  valorTotal = Math.round(valorTotal * 100) / 100;

  const nomeLote =
    typeof nome_lote === 'string' && nome_lote.trim()
      ? nome_lote.trim().slice(0, 120)
      : null;

  const { data: lote, error: loteErr } = await supabase
    .from('historico_inventario_varejo')
    .insert({
      user_id: userId,
      nome_lote: nomeLote,
      total_itens: lines.length,
      valor_total: valorTotal,
    })
    .select('id, created_at, nome_lote, total_itens, valor_total')
    .single();

  if (loteErr) {
    return res.status(500).json({ error: loteErr.message });
  }

  const itemRows = lines.map((line) => ({
    lote_id: lote.id,
    ean: line.ean,
    nome: line.nome,
    quantidade: line.quantidade,
    preco_unitario: line.preco_unitario,
    sort_order: line.sort_order,
  }));

  const { error: itemsErr } = await supabase.from('historico_inventario_varejo_itens').insert(itemRows);
  if (itemsErr) {
    await supabase.from('historico_inventario_varejo').delete().eq('id', lote.id);
    return res.status(500).json({ error: itemsErr.message });
  }

  return res.status(200).json({
    lote: {
      id: lote.id,
      created_at: lote.created_at,
      nome_lote: lote.nome_lote,
      total_itens: lote.total_itens,
      valor_total: Number(lote.valor_total),
    },
    itens: lines.length,
  });
}

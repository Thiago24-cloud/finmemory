import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';

/** GET /api/merchant/preparo?produto=uuid&porcoes=10 — planejamento de insumos. */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const produtoId = String(req.query.produto || '').trim();
  const porcoes = Math.max(1, Math.min(500, parseInt(String(req.query.porcoes || 10), 10) || 10));

  if (!produtoId) {
    return res.status(400).json({ error: 'Parâmetro produto obrigatório.' });
  }

  const { supabase, store } = auth;

  const { data: produto, error: prodErr } = await supabase
    .from('produtos_loja')
    .select('id, nome, preco_oferta, preco_original, insumo_id')
    .eq('id', produtoId)
    .eq('loja_id', store.id)
    .maybeSingle();

  if (prodErr) return res.status(500).json({ error: prodErr.message });
  if (!produto) return res.status(404).json({ error: 'Produto não encontrado.' });

  let composicoes = [];

  const { data: comps, error: compErr } = await supabase
    .from('produto_composicao_loja')
    .select('id, insumo_id, quantidade_porcao')
    .eq('produto_loja_id', produtoId)
    .eq('loja_id', store.id);

  if (compErr && !/produto_composicao_loja/i.test(compErr.message || '')) {
    return res.status(500).json({ error: compErr.message });
  }

  if (comps?.length) {
    composicoes = comps;
  } else if (produto.insumo_id) {
    composicoes = [{ id: null, insumo_id: produto.insumo_id, quantidade_porcao: 1 }];
  }

  const insumoIds = composicoes.map((c) => c.insumo_id).filter(Boolean);
  let insumosById = new Map();

  if (insumoIds.length) {
    const { data: insumos } = await supabase
      .from('insumos_loja')
      .select('id, nome, unidade, quantidade_atual')
      .eq('loja_id', store.id)
      .in('id', insumoIds);
    insumosById = new Map((insumos || []).map((i) => [i.id, i]));
  }

  const breakdown = composicoes.map((c) => {
    const insumo = insumosById.get(c.insumo_id);
    const perPortion = Number(c.quantidade_porcao) || 1;
    const needed = perPortion * porcoes;
    const available = Number(insumo?.quantidade_atual ?? 0);
    return {
      composicao_id: c.id,
      insumo_id: c.insumo_id,
      product_name: insumo?.nome || 'Insumo não encontrado',
      unit: insumo?.unidade || 'un',
      per_portion: perPortion,
      needed,
      available,
      sufficient: available >= needed,
    };
  });

  return res.status(200).json({
    produto: { id: produto.id, nome: produto.nome },
    porcoes,
    breakdown,
    has_insufficient: breakdown.some((b) => !b.sufficient),
  });
}

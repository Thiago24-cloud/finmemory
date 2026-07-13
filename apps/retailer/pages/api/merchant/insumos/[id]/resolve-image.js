import { requireMerchantApi } from '../../../../../lib/merchant/requireMerchantApi';
import { mapInsumoRowToApi } from '../../../../../lib/merchant/mapInsumoRow';
import { enrichInsumoImage } from '../../../../../lib/merchant/insumos/enrichInsumoImage';

const INSUMO_SELECT =
  'id, loja_id, nome, sku, ean, categoria, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, status_revisao, imagem_url, imagem_source, imagem_atualizada_em, na_cesta, cesta_quantidade, cesta_oferta, created_at, updated_at';

/**
 * POST /api/merchant/insumos/[id]/resolve-image — re-busca imagem (Cosmos / OFF / ícone).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const insumoId = String(req.query?.id || '').trim();
  if (!insumoId) {
    return res.status(400).json({ error: 'ID do insumo inválido.' });
  }

  const { supabase, store } = auth;
  const lojaId = store.id;

  const { data: existing, error: fetchErr } = await supabase
    .from('insumos_loja')
    .select(INSUMO_SELECT)
    .eq('id', insumoId)
    .eq('loja_id', lojaId)
    .maybeSingle();

  if (fetchErr) {
    return res.status(500).json({ error: fetchErr.message });
  }
  if (!existing) {
    return res.status(404).json({ error: 'Insumo não encontrado.' });
  }

  const nowIso = new Date().toISOString();
  await enrichInsumoImage(supabase, {
    lojaId,
    insumoId,
    nome: existing.nome,
    ean: existing.ean,
    currentImageUrl: existing.imagem_url,
    currentImageSource: existing.imagem_source,
    nowIso,
    force: true,
  }).catch(() => {});

  const { data: row, error: reloadErr } = await supabase
    .from('insumos_loja')
    .select(INSUMO_SELECT)
    .eq('id', insumoId)
    .maybeSingle();

  if (reloadErr) {
    return res.status(500).json({ error: reloadErr.message });
  }

  return res.status(200).json({ insumo: mapInsumoRowToApi(row) });
}

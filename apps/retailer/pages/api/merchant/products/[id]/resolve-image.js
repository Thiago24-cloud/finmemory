import { requireMerchantApi } from '../../../../../lib/merchant/requireMerchantApi';
import { mapProdutoRowToApi } from '../../../../../lib/merchant/mapProdutoRow';
import { resolveProdutoLojaImage } from '../../../../../lib/merchant/resolveProdutoLojaImage';

const PRODUTO_SELECT =
  'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, image_optimized_url, ean, categoria, imagem_source, insumo_id, status_disponivel, created_at, updated_at';

const PRODUTO_SELECT_FALLBACK =
  'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, image_optimized_url, status_disponivel, created_at, updated_at';

function isMissingCatalogColumnError(error) {
  return /ean|categoria|imagem_source|insumo_id|column/i.test(String(error?.message || ''));
}

function isMissingOptimizedColumnError(error) {
  return /image_optimized_url/i.test(String(error?.message || ''));
}

/**
 * POST /api/merchant/products/[id]/resolve-image — re-busca imagem do produto.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const productId = String(req.query?.id || '').trim();
  if (!productId) {
    return res.status(400).json({ error: 'ID do produto inválido.' });
  }

  const { supabase, store } = auth;
  const lojaId = store.id;

  let { data: existing, error: fetchErr } = await supabase
    .from('produtos_loja')
    .select(PRODUTO_SELECT)
    .eq('id', productId)
    .eq('loja_id', lojaId)
    .maybeSingle();

  if (fetchErr && (isMissingCatalogColumnError(fetchErr) || isMissingOptimizedColumnError(fetchErr))) {
    const retry = await supabase
      .from('produtos_loja')
      .select(PRODUTO_SELECT_FALLBACK)
      .eq('id', productId)
      .eq('loja_id', lojaId)
      .maybeSingle();
    existing = retry.data;
    fetchErr = retry.error;
  }

  if (fetchErr) {
    return res.status(500).json({ error: fetchErr.message });
  }
  if (!existing) {
    return res.status(404).json({ error: 'Produto não encontrado.' });
  }

  const resolved = await resolveProdutoLojaImage({
    nome: existing.nome,
    ean: existing.ean,
    imageUrl: existing.url_imagem,
    imagemSource: existing.imagem_source,
    forceRefresh: true,
  });

  const patch = {
    url_imagem: resolved.url_imagem,
    imagem_source: resolved.imagem_source,
    categoria: resolved.categoria,
    image_optimized_url: resolved.image_optimized_url,
    updated_at: new Date().toISOString(),
  };

  let { data: row, error: updErr } = await supabase
    .from('produtos_loja')
    .update(patch)
    .eq('id', productId)
    .eq('loja_id', lojaId)
    .select(PRODUTO_SELECT)
    .single();

  if (updErr && (isMissingCatalogColumnError(updErr) || isMissingOptimizedColumnError(updErr))) {
    const fallback = { ...patch };
    delete fallback.ean;
    delete fallback.categoria;
    delete fallback.imagem_source;
    if (isMissingOptimizedColumnError(updErr)) delete fallback.image_optimized_url;
    const retry = await supabase
      .from('produtos_loja')
      .update(fallback)
      .eq('id', productId)
      .eq('loja_id', lojaId)
      .select(PRODUTO_SELECT_FALLBACK)
      .single();
    row = retry.data;
    updErr = retry.error;
  }

  if (updErr) {
    return res.status(500).json({ error: updErr.message });
  }

  return res.status(200).json({ product: mapProdutoRowToApi(row) });
}

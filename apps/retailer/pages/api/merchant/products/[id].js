import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { mapProdutoRowToApi } from '../../../../lib/merchant/mapProdutoRow';
import { publishMerchantProductToMap } from '../../../../lib/merchant/publishMerchantProductToMap';
import { resolveProdutoLojaImage } from '../../../../lib/merchant/resolveProdutoLojaImage';
import { normalizeEanDigits } from '../../../../lib/merchant/mapInsumoRow';

function isMissingCatalogColumnError(error) {
  return /ean|categoria|imagem_source|insumo_id|ingredientes|column/i.test(String(error?.message || ''));
}

function isMissingOptimizedColumnError(error) {
  return /image_optimized_url/i.test(String(error?.message || ''));
}

/**
 * PATCH /api/merchant/products/[id] — atualiza produto / item do cardápio.
 * DELETE /api/merchant/products/[id] — remove item.
 */
export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const productId = String(req.query?.id || '').trim();
  if (!productId) {
    return res.status(400).json({ error: 'ID do produto inválido.' });
  }

  const { supabase, userId, store } = auth;
  const lojaId = store.id;

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('produtos_loja')
      .delete()
      .eq('id', productId)
      .eq('loja_id', lojaId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  let { data: existing, error: fetchErr } = await supabase
    .from('produtos_loja')
    .select(
      'id, loja_id, nome, descricao, ingredientes, preco_original, preco_oferta, em_oferta, url_imagem, image_optimized_url, ean, categoria, imagem_source, status_disponivel'
    )
    .eq('id', productId)
    .eq('loja_id', lojaId)
    .maybeSingle();

  if (fetchErr && (isMissingOptimizedColumnError(fetchErr) || isMissingCatalogColumnError(fetchErr))) {
    const retry = await supabase
      .from('produtos_loja')
      .select(
        'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, url_imagem, status_disponivel, categoria'
      )
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

  const body = req.body || {};
  const isMenuItem = body.menu_item === true || body.source === 'cardapio';
  const patch = { updated_at: new Date().toISOString() };

  if (body.name != null || body.nome != null) {
    const nome = String(body.name ?? body.nome).trim().slice(0, 200);
    if (nome.length < 2) return res.status(400).json({ error: 'Nome inválido.' });
    patch.nome = nome;
  }

  if (body.description != null || body.descricao != null) {
    patch.descricao = String(body.description ?? body.descricao).trim().slice(0, 4000) || null;
  }

  if (body.ingredients != null || body.ingredientes != null) {
    patch.ingredientes = String(body.ingredients ?? body.ingredientes).trim().slice(0, 4000) || null;
  }

  if (body.category != null || body.categoria != null) {
    patch.categoria = String(body.category ?? body.categoria).trim().slice(0, 120) || null;
  }

  if (body.price != null || body.preco_oferta != null) {
    const preco = Number(body.price ?? body.preco_oferta);
    if (!Number.isFinite(preco) || preco < 0) {
      return res.status(400).json({ error: 'Preço inválido.' });
    }
    patch.preco_oferta = Math.round(preco * 100) / 100;
  }

  if (body.preco_original != null) {
    const po = Number(body.preco_original);
    patch.preco_original = Number.isFinite(po) && po >= 0 ? Math.round(po * 100) / 100 : null;
  }

  if (body.image_url != null || body.url_imagem != null) {
    const url = String(body.image_url ?? body.url_imagem).trim().slice(0, 2048) || null;
    patch.url_imagem = url;
    patch.imagem_source = url ? 'custom' : null;
  }

  if (body.ean !== undefined || body.gtin !== undefined || body.barcode !== undefined) {
    patch.ean = normalizeEanDigits(body.ean ?? body.gtin ?? body.barcode);
  }

  const nextName = patch.nome ?? existing.nome;
  const nextImageUrl = patch.url_imagem ?? existing.url_imagem;
  const nextEan = patch.ean !== undefined ? patch.ean : existing.ean;
  const nextSource = patch.imagem_source ?? existing.imagem_source;
  const shouldResolve =
    patch.nome != null ||
    patch.url_imagem != null ||
    patch.ean !== undefined ||
    body.refresh_image === true;

  if (shouldResolve) {
    const resolvedImage = await resolveProdutoLojaImage({
      nome: nextName,
      ean: nextEan,
      imageUrl: nextImageUrl,
      imagemSource: nextSource,
      forceRefresh: body.refresh_image === true,
    });
    patch.url_imagem = resolvedImage.url_imagem ?? nextImageUrl;
    patch.imagem_source = resolvedImage.imagem_source;
    if (patch.categoria == null && existing.categoria == null) {
      patch.categoria = resolvedImage.categoria;
    }
    patch.image_optimized_url = resolvedImage.image_optimized_url || null;
  }

  if (typeof body.em_oferta === 'boolean') {
    patch.em_oferta = isMenuItem ? false : body.em_oferta;
  } else if (isMenuItem) {
    patch.em_oferta = false;
  }

  if (typeof body.status_disponivel === 'boolean') {
    patch.status_disponivel = body.status_disponivel;
  }

  let { data: row, error: updErr } = await supabase
    .from('produtos_loja')
    .update(patch)
    .eq('id', productId)
    .eq('loja_id', lojaId)
    .select(
      'id, loja_id, nome, descricao, ingredientes, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, image_optimized_url, categoria, status_disponivel, created_at, updated_at'
    )
    .single();

  if (updErr && (isMissingOptimizedColumnError(updErr) || isMissingCatalogColumnError(updErr))) {
    const retryPatch = { ...patch };
    delete retryPatch.image_optimized_url;
    delete retryPatch.ean;
    delete retryPatch.imagem_source;
    if (/ingredientes/i.test(String(updErr.message || ''))) {
      delete retryPatch.ingredientes;
    }
    const retry = await supabase
      .from('produtos_loja')
      .update(retryPatch)
      .eq('id', productId)
      .eq('loja_id', lojaId)
      .select(
        'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, categoria, status_disponivel, created_at, updated_at'
      )
      .single();
    row = retry.data;
    updErr = retry.error;
  }

  if (updErr) {
    return res.status(500).json({ error: updErr.message });
  }

  let published = false;
  let nearbyPush = null;
  const shouldPublish =
    !isMenuItem &&
    (body.publishToMap === true ||
      (typeof body.em_oferta === 'boolean' && body.em_oferta && !existing.em_oferta));

  if (shouldPublish && row.em_oferta && row.status_disponivel) {
    const pub = await publishMerchantProductToMap(supabase, {
      store,
      userId,
      name: row.nome,
      price: row.preco_oferta,
      imageUrl: row.url_imagem,
      description: row.descricao,
      flashOffer: Boolean(row.em_oferta),
      produtoLojaId: row.id,
    });
    if (!pub.ok) {
      return res.status(400).json({ error: pub.error || 'Erro ao publicar no mapa.', product: mapProdutoRowToApi(row) });
    }
    published = true;
    nearbyPush = pub.nearbyPush ?? null;
  }

  return res.status(200).json({
    product: mapProdutoRowToApi(row),
    published,
    menu_item: isMenuItem,
    nearby_push: nearbyPush,
  });
}

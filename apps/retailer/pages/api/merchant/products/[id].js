import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { mapProdutoRowToApi } from '../../../../lib/merchant/mapProdutoRow';
import { publishMerchantProductToMap } from '../../../../lib/merchant/publishMerchantProductToMap';

/**
 * PATCH /api/merchant/products/[id] — atualiza preço, foto, oferta relâmpago, disponibilidade.
 */
export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
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

  const { data: existing, error: fetchErr } = await supabase
    .from('produtos_loja')
    .select(
      'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, url_imagem, status_disponivel'
    )
    .eq('id', productId)
    .eq('loja_id', lojaId)
    .maybeSingle();

  if (fetchErr) {
    return res.status(500).json({ error: fetchErr.message });
  }
  if (!existing) {
    return res.status(404).json({ error: 'Produto não encontrado.' });
  }

  const body = req.body || {};
  const patch = { updated_at: new Date().toISOString() };

  if (body.name != null || body.nome != null) {
    const nome = String(body.name ?? body.nome).trim().slice(0, 200);
    if (nome.length < 2) return res.status(400).json({ error: 'Nome inválido.' });
    patch.nome = nome;
  }

  if (body.description != null || body.descricao != null) {
    patch.descricao = String(body.description ?? body.descricao).trim().slice(0, 500) || null;
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
  }

  if (typeof body.em_oferta === 'boolean') {
    patch.em_oferta = body.em_oferta;
  }

  if (typeof body.status_disponivel === 'boolean') {
    patch.status_disponivel = body.status_disponivel;
  }

  const { data: row, error: updErr } = await supabase
    .from('produtos_loja')
    .update(patch)
    .eq('id', productId)
    .eq('loja_id', lojaId)
    .select(
      'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, status_disponivel, created_at, updated_at'
    )
    .single();

  if (updErr) {
    return res.status(500).json({ error: updErr.message });
  }

  let published = false;
  let nearbyPush = null;
  const shouldPublish =
    body.publishToMap === true ||
    (typeof body.em_oferta === 'boolean' && body.em_oferta && !existing.em_oferta);

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
    nearby_push: nearbyPush,
  });
}

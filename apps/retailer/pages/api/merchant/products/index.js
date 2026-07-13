import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { publishMerchantProductToMap } from '../../../../lib/merchant/publishMerchantProductToMap';
import { mapProdutoRowToApi } from '../../../../lib/merchant/mapProdutoRow';
import { resolveProdutoLojaImage } from '../../../../lib/merchant/resolveProdutoLojaImage';
import { normalizeEanDigits } from '../../../../lib/merchant/mapInsumoRow';

function isMissingCatalogColumnError(error) {
  return /ean|categoria|imagem_source|insumo_id|ingredientes|column/i.test(String(error?.message || ''));
}

function isMissingOptimizedColumnError(error) {
  return /image_optimized_url/i.test(String(error?.message || ''));
}

/**
 * GET  /api/merchant/products — SELECT * FROM produtos_loja WHERE loja_id = tenant
 * POST /api/merchant/products — cria em public.produtos_loja + publica no mapa
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, userId, store } = auth;
  const lojaId = store.id;

  if (req.method === 'GET') {
    let { data, error } = await supabase
      .from('produtos_loja')
      .select(
        'id, loja_id, nome, descricao, ingredientes, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, image_optimized_url, ean, categoria, imagem_source, insumo_id, status_disponivel, created_at, updated_at'
      )
      .eq('loja_id', lojaId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error && (isMissingOptimizedColumnError(error) || isMissingCatalogColumnError(error))) {
      const retry = await supabase
        .from('produtos_loja')
        .select(
          'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, status_disponivel, created_at, updated_at'
        )
        .eq('loja_id', lojaId)
        .order('created_at', { ascending: false })
        .limit(200);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.message?.includes('produtos_loja')) {
        return res.status(503).json({
          error:
            'Tabela produtos_loja ainda não existe. Aplique as migrações 20260518160000 e 20260519120000 no Supabase.',
        });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      products: (data || []).map(mapProdutoRowToApi),
      store_id: lojaId,
      loja_id: lojaId,
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const isMenuItem = body.menu_item === true || body.source === 'cardapio';
    const nome = String(body.name || body.nome || '').trim().slice(0, 200);
    const ingredientes = String(body.ingredients || body.ingredientes || '').trim().slice(0, 4000) || null;
    const descricao = String(body.description || body.descricao || '').trim().slice(0, 4000) || null;
    const categoria =
      String(body.category || body.categoria || '').trim().slice(0, 120) || null;
    const imageUrl =
      String(body.image_url || body.imageUrl || body.url_imagem || '').trim().slice(0, 2048) || null;
    const ean = normalizeEanDigits(body.ean || body.gtin || body.barcode);
    const precoOferta = Number(body.price ?? body.preco_oferta);
    const precoOriginal =
      body.preco_original != null ? Number(body.preco_original) : precoOferta;
    // Cardápio de restaurante NUNCA publica no mapa de preços (mercados).
    const emOferta = isMenuItem ? false : body.em_oferta !== false;
    const estoque =
      body.quantidade_estoque != null ? parseInt(String(body.quantidade_estoque), 10) : null;

    if (!nome || nome.length < 2) {
      return res.status(400).json({ error: 'Informe o nome do produto.' });
    }
    if (isMenuItem && !ingredientes) {
      return res.status(400).json({ error: 'Informe os ingredientes do prato.' });
    }
    if (!Number.isFinite(precoOferta) || precoOferta < 0) {
      return res.status(400).json({ error: 'Informe um preço válido.' });
    }

    const nowIso = new Date().toISOString();
    const resolvedImage = await resolveProdutoLojaImage({
      nome,
      ean,
      imageUrl,
      imagemSource: imageUrl ? 'custom' : null,
    });

    const insertPayload = {
      loja_id: lojaId,
      nome,
      descricao,
      ingredientes,
      preco_original: Number.isFinite(precoOriginal) ? Math.round(precoOriginal * 100) / 100 : null,
      preco_oferta: Math.round(precoOferta * 100) / 100,
      em_oferta: emOferta,
      quantidade_estoque: Number.isFinite(estoque) ? estoque : null,
      url_imagem: resolvedImage.url_imagem || imageUrl,
      image_optimized_url: resolvedImage.image_optimized_url || null,
      ean,
      categoria: categoria || resolvedImage.categoria || null,
      imagem_source: resolvedImage.imagem_source || null,
      status_disponivel: true,
      updated_at: nowIso,
    };

    let { data: row, error: insErr } = await supabase
      .from('produtos_loja')
      .insert(insertPayload)
      .select(
        'id, loja_id, nome, descricao, ingredientes, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, image_optimized_url, ean, categoria, status_disponivel, created_at'
      )
      .single();

    if (insErr && (isMissingOptimizedColumnError(insErr) || isMissingCatalogColumnError(insErr))) {
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.image_optimized_url;
      delete fallbackPayload.ean;
      delete fallbackPayload.imagem_source;
      if (/ingredientes/i.test(String(insErr.message || ''))) {
        delete fallbackPayload.ingredientes;
        if (ingredientes) {
          fallbackPayload.descricao = [
            `Ingredientes: ${ingredientes}`,
            descricao ? `Preparo: ${descricao}` : null,
          ]
            .filter(Boolean)
            .join('\n\n')
            .slice(0, 4000);
        }
      }
      if (!categoria) delete fallbackPayload.categoria;
      const retry = await supabase
        .from('produtos_loja')
        .insert(fallbackPayload)
        .select(
          'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, categoria, status_disponivel, created_at'
        )
        .single();
      row = retry.data;
      insErr = retry.error;
    }

    if (insErr) {
      if (insErr.message?.includes('produtos_loja')) {
        return res.status(503).json({
          error: 'Tabela produtos_loja ainda não existe. Aplique a migração 20260519120000 no Supabase.',
        });
      }
      return res.status(500).json({ error: insErr.message });
    }

    let published = false;
    let mapValidUntil = null;
    let nearbyPush = null;

    if (!isMenuItem && emOferta && row.status_disponivel !== false) {
      const pub = await publishMerchantProductToMap(supabase, {
        store,
        userId,
        name: nome,
        price: row.preco_oferta,
        imageUrl: row.url_imagem,
        description: descricao,
        flashOffer: emOferta,
        produtoLojaId: row.id,
      });

      if (!pub.ok) {
        await supabase.from('produtos_loja').delete().eq('id', row.id);
        return res.status(400).json({ error: pub.error || 'Erro ao publicar no mapa.' });
      }
      published = true;
      mapValidUntil = pub.validUntil;
      nearbyPush = pub.nearbyPush ?? null;
    }

    return res.status(201).json({
      product: mapProdutoRowToApi(row),
      published,
      menu_item: isMenuItem,
      map_valid_until: mapValidUntil,
      nearby_push: nearbyPush,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

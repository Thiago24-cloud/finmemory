import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { publishMerchantProductToMap } from '../../../../lib/merchant/publishMerchantProductToMap';
import { mapProdutoRowToApi } from '../../../../lib/merchant/mapProdutoRow';
import { resolveProdutoLojaImage } from '../../../../lib/merchant/resolveProdutoLojaImage';
import { normalizeEanDigits } from '../../../../lib/merchant/mapInsumoRow';

function isMissingCatalogColumnError(error) {
  return /ean|categoria|imagem_source|insumo_id|column/i.test(String(error?.message || ''));
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
        'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, image_optimized_url, ean, categoria, imagem_source, insumo_id, status_disponivel, created_at, updated_at'
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
    const nome = String(body.name || body.nome || '').trim().slice(0, 200);
    const descricao = String(body.description || body.descricao || '').trim().slice(0, 500) || null;
    const imageUrl =
      String(body.image_url || body.imageUrl || body.url_imagem || '').trim().slice(0, 2048) || null;
    const ean = normalizeEanDigits(body.ean || body.gtin || body.barcode);
    const precoOferta = Number(body.price ?? body.preco_oferta);
    const precoOriginal =
      body.preco_original != null ? Number(body.preco_original) : precoOferta;
    const emOferta = body.em_oferta !== false;
    const estoque =
      body.quantidade_estoque != null ? parseInt(String(body.quantidade_estoque), 10) : null;

    if (!nome || nome.length < 2) {
      return res.status(400).json({ error: 'Informe o nome do produto.' });
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
      preco_original: Number.isFinite(precoOriginal) ? Math.round(precoOriginal * 100) / 100 : null,
      preco_oferta: Math.round(precoOferta * 100) / 100,
      em_oferta: emOferta,
      quantidade_estoque: Number.isFinite(estoque) ? estoque : null,
      url_imagem: resolvedImage.url_imagem || imageUrl,
      image_optimized_url: resolvedImage.image_optimized_url || null,
      ean,
      categoria: resolvedImage.categoria || null,
      imagem_source: resolvedImage.imagem_source || null,
      status_disponivel: true,
      updated_at: nowIso,
    };

    let { data: row, error: insErr } = await supabase
      .from('produtos_loja')
      .insert(insertPayload)
      .select(
        'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, image_optimized_url, status_disponivel, created_at'
      )
      .single();

    if (insErr && (isMissingOptimizedColumnError(insErr) || isMissingCatalogColumnError(insErr))) {
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.image_optimized_url;
      delete fallbackPayload.ean;
      delete fallbackPayload.categoria;
      delete fallbackPayload.imagem_source;
      const retry = await supabase
        .from('produtos_loja')
        .insert(fallbackPayload)
        .select(
          'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, status_disponivel, created_at'
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

    if (emOferta && row.status_disponivel !== false) {
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
      map_valid_until: mapValidUntil,
      nearby_push: nearbyPush,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

import {
  cosmosUnavailablePayload,
  fetchCosmosProductByGtin,
  getCosmosToken,
  isCosmosLookupAuthorized,
  normalizeCosmosGtin,
  pickBestCosmosProduct,
  resolveCosmosProductImage,
  searchCosmosProductsByQuery,
} from '@finmemory/shared/cosmos';

/**
 * GET /api/catalog/cosmos/lookup
 * API canônica Cosmos — usada pelo app consumidor e pelo painel lojista (via proxy).
 *
 * Query:
 *   gtin=789...           → produto por código de barras
 *   name= ou query=       → busca por nome (mode=search devolve lista)
 *   mode=search           → { products: [...] }
 *   mode=resolve          → resolve imagem/dados por gtin+name
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (
    !isCosmosLookupAuthorized(
      req.headers['x-finmemory-cosmos-secret'],
      req.query?.secret
    )
  ) {
    return res.status(401).json({
      error: 'Não autorizado.',
      code: 'COSMOS_LOOKUP_UNAUTHORIZED',
    });
  }

  if (!getCosmosToken()) {
    return res.status(503).json(cosmosUnavailablePayload());
  }

  const mode = String(req.query?.mode || '').trim().toLowerCase();
  const gtin = normalizeCosmosGtin(
    req.query?.gtin || req.query?.ean || req.query?.barcode
  );
  const name = String(req.query?.name || req.query?.query || '').trim();

  try {
    if (mode === 'search') {
      if (name.length < 3) {
        return res.status(400).json({
          error: 'Informe name ou query com pelo menos 3 caracteres.',
          code: 'INVALID_QUERY',
        });
      }
      const products = await searchCosmosProductsByQuery(name);
      const best = pickBestCosmosProduct(name, products);
      return res.status(200).json({
        found: products.length > 0,
        query: name,
        products,
        best,
      });
    }

    if (mode === 'resolve' || (gtin && name)) {
      const product = await resolveCosmosProductImage({ gtin, name });
      if (!product) {
        return res.status(404).json({
          found: false,
          gtin,
          name,
          error: 'Produto não encontrado no Cosmos.',
          code: 'COSMOS_NOT_FOUND',
        });
      }
      return res.status(200).json({ found: true, gtin: product.gtin, product });
    }

    if (gtin) {
      const product = await fetchCosmosProductByGtin(gtin);
      if (!product) {
        return res.status(404).json({
          found: false,
          gtin,
          error: 'Produto não encontrado no Cosmos.',
          code: 'COSMOS_NOT_FOUND',
        });
      }
      return res.status(200).json({ found: true, gtin, product });
    }

    if (name.length >= 3) {
      const products = await searchCosmosProductsByQuery(name);
      const best = pickBestCosmosProduct(name, products);
      if (!best) {
        return res.status(404).json({
          found: false,
          query: name,
          error: 'Produto não encontrado no Cosmos.',
          code: 'COSMOS_NOT_FOUND',
        });
      }
      return res.status(200).json({
        found: true,
        query: name,
        product: best,
        products,
      });
    }

    return res.status(400).json({
      error: 'Informe gtin, name ou query.',
      code: 'INVALID_PARAMS',
    });
  } catch (error) {
    console.error('[catalog/cosmos/lookup]', error?.message || error);
    return res.status(502).json({
      error: 'Falha ao consultar o Cosmos.',
      code: 'COSMOS_LOOKUP_FAILED',
    });
  }
}

import { cosmosUnavailablePayload, getCosmosToken } from '../../../../../lib/cosmos';
import {
  fetchCosmosProductByGtin,
  normalizeCosmosGtin,
} from '../../../../../lib/catalog/cosmosApiClient';
import { requireMerchantApi } from '../../../../../lib/merchant/requireMerchantApi';

/**
 * GET /api/merchant/catalog/cosmos/lookup?gtin=789...
 * Consulta o Cosmos no servidor para pré-preencher cadastro de insumo após leitura de código.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const gtin = normalizeCosmosGtin(req.query?.gtin || req.query?.ean || req.query?.barcode);
  if (!gtin) {
    return res.status(400).json({
      error: 'Código de barras inválido.',
      code: 'INVALID_GTIN',
    });
  }

  if (!getCosmosToken()) {
    return res.status(503).json(cosmosUnavailablePayload());
  }

  try {
    const product = await fetchCosmosProductByGtin(gtin);
    if (!product) {
      return res.status(404).json({
        found: false,
        gtin,
        error: 'Produto não encontrado no Cosmos.',
        code: 'COSMOS_NOT_FOUND',
      });
    }

    return res.status(200).json({
      found: true,
      gtin,
      product,
    });
  } catch (error) {
    console.error('[catalog/cosmos/lookup]', error?.message || error);
    return res.status(502).json({
      error: 'Falha ao consultar o Cosmos.',
      code: 'COSMOS_LOOKUP_FAILED',
    });
  }
}

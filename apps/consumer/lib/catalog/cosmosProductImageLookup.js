import { fetchCosmosBluesoftByGtin } from '../gtinProductLookup.js';
import {
  normalizeCosmosGtin,
  normalizeProductNameForCosmos,
  resolveCosmosImageByProductName,
} from './cosmosApiClient.js';

export { normalizeProductNameForCosmos } from './cosmosApiClient.js';

/**
 * @param {string} productName
 * @returns {Promise<{ gtin: string, imageUrl: string, name: string } | null>}
 */
export async function searchCosmosProductByName(productName) {
  const hit = await resolveCosmosImageByProductName(productName);
  if (!hit?.imageUrl) return null;
  return {
    gtin: hit.gtin || '',
    imageUrl: hit.imageUrl,
    name: hit.name,
  };
}

/**
 * Resolve imagem no Cosmos (GTIN direto ou busca por nome).
 * @param {{ nome?: string, name?: string, product_name?: string, gtin?: string, ean?: string, barcode?: string }} product
 */
export async function resolveCosmosImageForProduct(product) {
  const gtin = normalizeCosmosGtin(
    product?.gtin ?? product?.ean ?? product?.barcode ?? product?.codigo_barras ?? product?.raw?.gtin
  );
  if (gtin) {
    const row = await fetchCosmosBluesoftByGtin(gtin);
    if (row?.imageUrl) {
      return { source: 'cosmos_gtin', gtin, imageUrl: row.imageUrl, name: row.name };
    }
  }

  const name =
    String(product?.nome || product?.name || product?.product_name || '').trim() ||
    String(product?.raw?.nome || product?.raw?.name || '').trim();
  if (!name) return null;

  const searched = await searchCosmosProductByName(name);
  if (!searched?.imageUrl) return null;
  return {
    source: 'cosmos_search',
    gtin: searched.gtin,
    imageUrl: searched.imageUrl,
    name: searched.name || name,
  };
}

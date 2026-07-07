export {
  getCosmosToken,
  cosmosUnavailablePayload,
  getCosmosLookupSecret,
  isCosmosLookupAuthorized,
} from './token';

export {
  COSMOS_ORIGIN,
  normalizeCosmosGtin,
  normalizeProductNameForCosmos,
  mapCosmosGtinPayload,
  extractCosmosProductList,
  mapCosmosProductHit,
  pickBestCosmosProduct,
  fetchCosmosProductByGtin,
  searchCosmosProductsByQuery,
  resolveCosmosProductImage,
  resolveCosmosImageByProductName,
} from './client';

export type { CosmosProduct } from './client';

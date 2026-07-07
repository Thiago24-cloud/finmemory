/**
 * Proxy para a API Cosmos canônica do app consumidor.
 * @see apps/consumer/pages/api/catalog/cosmos/lookup.js
 */
export {
  fetchCosmosProductByGtin,
  searchCosmosProductsByQuery,
  resolveCosmosProductImage,
  isCosmosConsumerUnavailableError,
} from '../merchant/cosmosConsumerClient';

export {
  normalizeCosmosGtin,
  normalizeProductNameForCosmos,
  pickBestCosmosProduct,
} from '@finmemory/shared/cosmos';

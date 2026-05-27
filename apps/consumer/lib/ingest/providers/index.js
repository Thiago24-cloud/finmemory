export {
  ProviderValidationError,
  FlyerProviderBase,
  normalizeUnit,
  assertOnlySpFromHints,
  assertContextLinkedToSaoPaulo,
  validateProviderResultLinkedToSp,
} from './base.js';
export { listIngestProviders, resolveIngestProvider } from './registry.js';
export { buildDiaStorePageProviderPayload } from './diaStorePageProvider.js';
export {
  buildPaoDeAcucarFlyerPayload,
  PaoDeAcucarFlyerProvider,
  ORIGEM_PAO_DE_ACUCAR_FLYER,
} from './pao_de_acucar_flyer.js';
export {
  buildMamboFlyerPayload,
  MamboFlyerProvider,
  ORIGEM_MAMBO_FLYER,
} from './mambo_flyer.js';
export {
  buildCarrefourFlyerPayload,
  CarrefourFlyerProvider,
  ORIGEM_CARREFOUR_FLYER,
} from './carrefour_flyer.js';
export {
  buildUniversalOffersFromContext,
  inferCityFromContext,
  inferScopeByCity,
} from './universalFlyerExtractor.js';

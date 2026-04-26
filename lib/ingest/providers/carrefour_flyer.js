import { FlyerProviderBase, ProviderValidationError } from './base.js';
import {
  buildUniversalOffersFromContext,
  inferCityFromContext,
  inferScopeByCity,
} from './universalFlyerExtractor.js';
import { inferDddByCity, inferMacroRegion, SP_GRANDE_SP_CITIES } from '../run.js';

export const ORIGEM_CARREFOUR_FLYER = 'carrefour_flyer';

/**
 * Carrefour / Atacadão — tabloide digital e ofertas regionais (SP).
 * Stub: muitas vezes há API JSON ou página com estado/cidade na querystring.
 */
export class CarrefourFlyerProvider extends FlyerProviderBase {
  constructor() {
    super(ORIGEM_CARREFOUR_FLYER);
  }

  /**
   * @param {object} context — runId, parsed, lat, lng, storeUrl, metadata (ver base.js)
   */
  extract(context) {
    const { offers, isStatewide } = buildUniversalOffersFromContext(context);
    const city = inferCityFromContext(context);
    const resolvedCity = isStatewide ? null : city;
    const scope = isStatewide ? 'Estadual' : inferScopeByCity(resolvedCity, SP_GRANDE_SP_CITIES);
    const region = resolvedCity ? inferMacroRegion(resolvedCity) : null;
    const dddCode = resolvedCity ? inferDddByCity(resolvedCity) : null;
    if (!offers.length) {
      throw new ProviderValidationError('Carrefour: nenhum candidato extraído pelos padrões universais', {
        origem: this.origem,
        code: 'NO_OFFERS_EXTRACTED',
      });
    }
    const produtos = offers.map((o) => ({
      ...o,
      locality_city: resolvedCity,
      locality_state: 'SP',
      locality_region: region,
      ddd_code: dddCode,
      is_statewide: Boolean(isStatewide),
      metadata: {
        source: this.origem,
      },
    }));
    return {
      storeName: String(context?.parsed?.store_name || 'Carrefour').trim(),
      storeAddress: null,
      storeLat: Number(context?.lat),
      storeLng: Number(context?.lng),
      localityScope: scope,
      localityCity: resolvedCity,
      localityRegion: region,
      localityState: 'SP',
      dddCode: dddCode ?? null,
      isStatewide: Boolean(isStatewide),
      origem: this.origem,
      produtos,
    };
  }
}

/** @param {object} context */
export function buildCarrefourFlyerPayload(context) {
  return new CarrefourFlyerProvider().build(context);
}

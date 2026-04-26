import { FlyerProviderBase, ProviderValidationError } from './base.js';
import {
  buildUniversalOffersFromContext,
  inferCityFromContext,
  inferScopeByCity,
} from './universalFlyerExtractor.js';
import { inferDddByCity, inferMacroRegion, SP_GRANDE_SP_CITIES } from '../run.js';

export const ORIGEM_PAO_DE_ACUCAR_FLYER = 'pao_de_acucar_flyer';

/**
 * Pão de Açúcar — tabloide digital / “Meu Desconto” (SP).
 * Stub: implementar scraping ou chamada à API interna da rede e mapear para {@link ProviderResult}.
 */
export class PaoDeAcucarFlyerProvider extends FlyerProviderBase {
  constructor() {
    super(ORIGEM_PAO_DE_ACUCAR_FLYER);
  }

  /**
   * @param {object} context
   */
  extract(context) {
    const { offers, isStatewide } = buildUniversalOffersFromContext(context);
    const city = inferCityFromContext(context);
    const resolvedCity = isStatewide ? null : city;
    const scope = isStatewide ? 'Estadual' : inferScopeByCity(resolvedCity, SP_GRANDE_SP_CITIES);
    const region = resolvedCity ? inferMacroRegion(resolvedCity) : null;
    const dddCode = resolvedCity ? inferDddByCity(resolvedCity) : null;
    if (!offers.length) {
      throw new ProviderValidationError('Pão de Açúcar: nenhum candidato extraído pelos padrões universais', {
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
      storeName: String(context?.parsed?.store_name || 'Pão de Açúcar').trim(),
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

/** @param {import('./base.js').ProviderContext} context */
export function buildPaoDeAcucarFlyerPayload(context) {
  return new PaoDeAcucarFlyerProvider().build(context);
}

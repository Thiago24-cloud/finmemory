import { buildDiaStorePageProviderPayload } from './diaStorePageProvider.js';
import {
  ProviderValidationError,
  assertContextLinkedToSaoPaulo,
  validateProviderResultLinkedToSp,
} from './base.js';
import { buildPaoDeAcucarFlyerPayload } from './pao_de_acucar_flyer.js';
import { buildMamboFlyerPayload } from './mambo_flyer.js';
import { buildCarrefourFlyerPayload } from './carrefour_flyer.js';

const providers = {
  dia_store_page: buildDiaStorePageProviderPayload,
  pao_de_acucar_flyer: buildPaoDeAcucarFlyerPayload,
  mambo_flyer: buildMamboFlyerPayload,
  carrefour_flyer: buildCarrefourFlyerPayload,
};

/**
 * Envolve o provider: valida contexto SP antes de executar e resultado SP antes de enfileirar.
 * @param {string} key
 * @param {(ctx: object) => object} fn
 */
function wrapProviderWithSpGate(key, fn) {
  return (ctx) => {
    try {
      assertContextLinkedToSaoPaulo(ctx);
    } catch (error) {
      console.error('[ingest.registry] payload descartado por contexto fora de SP', {
        provider: key,
        runId: ctx?.runId || null,
        source: ctx?.source || null,
        details: error?.details || null,
      });
      throw error;
    }
    const result = fn(ctx);
    validateProviderResultLinkedToSp(result, key);
    return result;
  };
}

export function listIngestProviders() {
  return Object.keys(providers);
}

export function resolveIngestProvider(providerName) {
  const key = String(providerName || '').trim().toLowerCase();
  const provider = providers[key];
  if (!provider) {
    throw new ProviderValidationError(`Provider "${providerName}" não encontrado`, {
      availableProviders: listIngestProviders(),
    });
  }
  return wrapProviderWithSpGate(key, provider);
}

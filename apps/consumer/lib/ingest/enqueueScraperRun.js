import { splitProdutosByPublishReadiness } from '../promoQueueProcessing.js';
import { publishScraperToMap } from './publishScraperToMap.js';

/**
 * Scraper → mapa direto (sem fila pendente no admin).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   origem: string,
 *   storeName: string,
 *   storeAddress?: string | null,
 *   storeLat: number,
 *   storeLng: number,
 *   localityScope?: string,
 *   localityCity?: string | null,
 *   localityRegion?: string | null,
 *   localityState?: string,
 *   dddCode?: string | null,
 *   isStatewide?: boolean,
 *   produtos: object[],
 *   artifacts?: Record<string, unknown>,
 *   priceSource?: string,
 * }} payload
 */
export async function enqueueScraperRun(supabase, payload) {
  const produtos = Array.isArray(payload.produtos) ? payload.produtos : [];
  if (!produtos.length) {
    return { ok: false, error: 'produtos vazio' };
  }

  const split = splitProdutosByPublishReadiness(produtos);
  const artifacts = {
    ...(payload.artifacts && typeof payload.artifacts === 'object' ? payload.artifacts : {}),
    readiness: {
      ready: split.ready.length,
      pendingImage: split.pendingImage.length,
      invalid: split.invalid.length,
    },
  };

  const published = await publishScraperToMap(supabase, {
    ...payload,
    artifacts,
    priceSource: payload.priceSource || payload.origem,
  });

  if (!published.ok) {
    return { ok: false, error: published.error };
  }

  return {
    ok: true,
    filaId: published.filaId,
    status: published.status,
    produtosTotal: produtos.length,
    inserted: published.inserted || 0,
    readiness: published.readiness,
  };
}

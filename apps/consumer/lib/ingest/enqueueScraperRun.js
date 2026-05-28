import { enqueuePromocoes } from './enqueuePromocoes.js';
import { splitProdutosByPublishReadiness } from '../promoQueueProcessing.js';
import { autoPublishQueueItem } from './autoPublishQueueItem.js';

/**
 * Enfileira lote do scraper com status `pendente` (nunca publica no mapa).
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

  const queued = await enqueuePromocoes(supabase, {
    storeName: payload.storeName,
    storeAddress: payload.storeAddress ?? null,
    storeLat: payload.storeLat,
    storeLng: payload.storeLng,
    localityScope: payload.localityScope,
    localityCity: payload.localityCity ?? null,
    localityRegion: payload.localityRegion ?? null,
    localityState: payload.localityState || 'SP',
    dddCode: payload.dddCode ?? null,
    isStatewide: Boolean(payload.isStatewide),
    produtos,
    artifacts,
    origem: payload.origem,
  });

  if (!queued.ok) {
    return { ok: false, error: queued.error };
  }

  const { data: queueRow, error: queueFetchErr } = await supabase
    .from('bot_promocoes_fila')
    .select('*')
    .eq('id', queued.filaId)
    .single();
  if (queueFetchErr || !queueRow) {
    return { ok: false, error: queueFetchErr?.message || 'Não foi possível carregar item enfileirado' };
  }

  const autoPublished = await autoPublishQueueItem(supabase, queueRow, {
    reviewerEmail: 'scraper-auto@finmemory.local',
  });
  if (!autoPublished.ok) {
    return { ok: false, error: `Falha na publicação automática: ${autoPublished.error}` };
  }

  return {
    ok: true,
    filaId: queued.filaId,
    status: 'aprovado',
    produtosTotal: produtos.length,
    inserted: autoPublished.inserted || 0,
    readiness: {
      ready: split.ready.length,
      pendingImage: split.pendingImage.length,
      invalid: split.invalid.length,
    },
  };
}

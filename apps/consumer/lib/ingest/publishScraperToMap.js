import { splitProdutosByPublishReadiness, normalizeQueuedProduto } from '../promoQueueProcessing.js';
import { resolveOwnerUserId } from '../botPromoOwner.js';
import { afterMapPricePointsInsert } from '../catalog/afterMapPricePointsInsert.js';
import { normalizeCnpjDigits } from './cnpj.js';

function toIsoDateOnly(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function inferScope(item, produtoRaw) {
  return produtoRaw?.locality_scope || item?.locality_scope || produtoRaw?.escopo_localidade || 'Estadual';
}

function inferCity(item, produtoRaw) {
  return produtoRaw?.locality_city || item?.locality_city || produtoRaw?.cidade || null;
}

function inferRegion(item, produtoRaw) {
  return produtoRaw?.locality_region || item?.locality_region || null;
}

/**
 * Publica scraper direto no mapa (price_points), sem deixar pendente no admin.
 * Grava auditoria em bot_promocoes_fila com status `aprovado`.
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
 *   replaceHours?: number,
 * }} payload
 */
export async function publishScraperToMap(supabase, payload) {
  const produtos = Array.isArray(payload.produtos) ? payload.produtos : [];
  if (!produtos.length) return { ok: false, error: 'produtos vazio' };

  const ownerUserId = await resolveOwnerUserId(supabase, 'scraper-auto@finmemory.local');
  if (!ownerUserId) {
    return {
      ok: false,
      error:
        'Defina BOT_PROMO_OWNER_USER_ID, MAP_QUICK_ADD_BOT_USER_ID ou DIA_BOT_USER_ID (UUID em public.users)',
    };
  }

  const normalized = produtos.map((p) => normalizeQueuedProduto(p));
  const publishable = normalized.filter((p) => Number.isFinite(p.price) && p.price > 0 && p.name);
  const split = splitProdutosByPublishReadiness(produtos);

  if (!publishable.length) {
    return { ok: false, error: 'Nenhum produto publicável (preço válido)' };
  }

  const artifacts = payload.artifacts && typeof payload.artifacts === 'object' ? payload.artifacts : {};
  const cnpjDigits = normalizeCnpjDigits(artifacts.cnpj || artifacts.store_cnpj || null);
  const now = new Date().toISOString();
  const priceSource = payload.priceSource || payload.origem || 'scraper_auto';

  const { data: insertedFila, error: filaErr } = await supabase
    .from('bot_promocoes_fila')
    .insert({
      store_name: payload.storeName,
      store_address: payload.storeAddress || null,
      store_lat: payload.storeLat,
      store_lng: payload.storeLng,
      locality_scope: payload.localityScope || null,
      locality_city: payload.localityCity ?? null,
      locality_region: payload.localityRegion ?? null,
      locality_state: payload.localityState || 'SP',
      ddd_code: payload.dddCode ?? null,
      is_statewide: Boolean(payload.isStatewide),
      produtos,
      artifacts: {
        ...artifacts,
        auto_publish: true,
        published_at: now,
      },
      origem: payload.origem,
      status: 'aprovado',
      reviewed_at: now,
      reviewed_by: 'scraper-auto@finmemory.local',
    })
    .select('id')
    .single();

  if (filaErr) {
    return { ok: false, error: filaErr.message };
  }

  const { error: storeRpcErr } = await supabase.rpc('find_or_create_store', {
    p_name: payload.storeName,
    p_address: payload.storeAddress || '',
    p_lat: payload.storeLat,
    p_lng: payload.storeLng,
    p_cnpj: cnpjDigits.length >= 14 ? cnpjDigits : null,
  });
  if (storeRpcErr) {
    return { ok: false, error: storeRpcErr.message, filaId: insertedFila?.id };
  }

  const replaceHours = Math.max(
    1,
    Math.min(parseInt(String(payload.replaceHours || process.env.SCRAPER_DIA_REPLACE_HOURS || '24'), 10) || 24, 168)
  );
  const cutoffIso = new Date(Date.now() - replaceHours * 60 * 60 * 1000).toISOString();
  await supabase
    .from('price_points')
    .delete()
    .eq('store_name', payload.storeName)
    .eq('source', priceSource)
    .gte('created_at', cutoffIso)
    .ilike('category', '%promo%');

  const defaultExpiry = toIsoDateOnly(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const rows = publishable.map((p) => {
    const raw = p.raw || {};
    const isStatewide = Boolean(raw.is_statewide || payload.isStatewide || inferScope(payload, raw) === 'Estadual');
    const locCity = payload.localityCity || raw.locality_city || null;
    return {
      user_id: ownerUserId,
      store_name: payload.storeName,
      lat: payload.storeLat,
      lng: payload.storeLng,
      product_name: p.name,
      price: Number(p.price),
      image_url: p.image_url || null,
      category: 'Supermercado - Promoção',
      source: priceSource,
      created_at: now,
      atualizado_em: now,
      locality_scope: isStatewide ? 'Estadual' : inferScope(payload, raw),
      locality_city: isStatewide ? null : inferCity(payload, raw),
      locality_region: isStatewide ? null : inferRegion(payload, raw),
      locality_state: payload.localityState || 'SP',
      ddd_code: payload.dddCode || raw.ddd_code || null,
      is_statewide: isStatewide,
      expires_at:
        toIsoDateOnly(p.valid_until || raw.valid_until || raw.validade || raw.expiry_date) || defaultExpiry,
    };
  });

  const { error: insertErr } = await supabase.from('price_points').insert(rows);
  if (insertErr) {
    return { ok: false, error: insertErr.message, filaId: insertedFila?.id };
  }

  afterMapPricePointsInsert({ rows, storeName: payload.storeName, source: priceSource });

  return {
    ok: true,
    filaId: insertedFila?.id,
    status: 'aprovado',
    inserted: rows.length,
    produtosTotal: produtos.length,
    readiness: {
      ready: split.ready.length,
      pendingImage: split.pendingImage.length,
      invalid: split.invalid.length,
      publishedWithoutImage: publishable.length - split.ready.length,
    },
  };
}

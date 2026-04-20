/**
 * Cache persistente de miniatura por nome de produto (mapa).
 * Ordem: regra (image_url no painel) → map_product_image_cache → Open Food Facts → Google CSE (opcional).
 */

import {
  findDirectThumbnailRuleImageUrl,
  resolveThumbnailFromExternalApisOnly,
  isValidResolvedImage,
} from './externalProductImages';
import { needsThumbnailEnrichment } from './enrichMapPointImages';
import { buildThumbnailImagePlanAsync } from './mapProductImageSearchPlan';

export function normalizeMapProductImageKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

export async function getCachedImageUrlFromDb(supabase, productName) {
  const normKey = normalizeMapProductImageKey(productName);
  if (!normKey || normKey.length < 2) return null;
  const { data, error } = await supabase
    .from('map_product_image_cache')
    .select('image_url')
    .eq('norm_key', normKey)
    .maybeSingle();
  if (error || !data?.image_url) return null;
  return isValidResolvedImage(data.image_url) ? String(data.image_url).trim() : null;
}

/** Tenta várias chaves (produto + categorias / sinónimos do plano). */
export async function getFirstCachedImageUrlFromKeys(supabase, normKeys) {
  const keys = Array.from(
    new Set(
      (normKeys || [])
        .map((k) => normalizeMapProductImageKey(k))
        .filter((k) => k && k.length >= 2)
    )
  );
  if (!keys.length) return null;
  const { data, error } = await supabase
    .from('map_product_image_cache')
    .select('norm_key, image_url')
    .in('norm_key', keys);
  if (error || !data?.length) return null;
  const byKey = new Map();
  for (const row of data) {
    const u = row?.image_url;
    if (u && isValidResolvedImage(u)) byKey.set(row.norm_key, String(u).trim());
  }
  for (const k of keys) {
    const u = byKey.get(k);
    if (u) return u;
  }
  return null;
}

export async function upsertImageCacheRow(supabase, productName, imageUrl, source = 'resolver') {
  const normKey = normalizeMapProductImageKey(productName);
  const u = String(imageUrl || '').trim();
  if (!normKey || normKey.length < 2 || !u || !isValidResolvedImage(u)) return false;
  if (/^data:image\//i.test(u)) return false;
  const display = String(productName || '').trim().slice(0, 280);
  const { error } = await supabase.from('map_product_image_cache').upsert(
    {
      norm_key: normKey,
      display_name: display || normKey,
      image_url: u,
      source: String(source || 'resolver').slice(0, 64),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'norm_key' }
  );
  if (error) {
    console.warn('map_product_image_cache upsert:', error.message);
    return false;
  }
  return true;
}

/**
 * Resolve URL e grava no cache quando veio de OFF/CSE (não re-grava se já existia igual).
 * @param {{ useGoogleCse?: boolean }} opts
 */
export async function resolveProductThumbnailUrl(supabase, productName, storeName, opts = {}) {
  const useGoogleCse = Boolean(opts.useGoogleCse);
  const store = storeName || '';

  const direct = await findDirectThumbnailRuleImageUrl(productName, store);
  if (direct && isValidResolvedImage(direct)) {
    await upsertImageCacheRow(supabase, productName, direct, 'thumbnail_rule');
    return { url: direct, source: 'thumbnail_rule' };
  }

  const plan = await buildThumbnailImagePlanAsync(productName, store);
  const cached = await getFirstCachedImageUrlFromKeys(supabase, plan.cacheLookupKeys);
  if (cached) return { url: cached, source: 'cache' };

  const { url, source } = await resolveThumbnailFromExternalApisOnly(productName, store, useGoogleCse);
  if (!url) return { url: null, source: null };

  await upsertImageCacheRow(supabase, productName, url, source || 'resolver');
  return { url, source: source || 'resolver' };
}

/**
 * Preenche promo_image_url a partir do cache em lote (uma query).
 * Regras do painel com `image_url` têm prioridade absoluta: substituem qualquer URL já vinda do price_points / catálogo.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ product_name: string, promo_image_url?: string|null }>} points
 */
export async function hydratePointsFromImageCache(supabase, points) {
  if (!supabase || !Array.isArray(points) || !points.length) return;

  const directMemo = new Map();
  const upsertByNormKey = new Map();
  for (const p of points) {
    const name = String(p.product_name || '').trim();
    if (!name) continue;
    const pk = normalizeMapProductImageKey(name);
    const sk = normalizeMapProductImageKey(p.store_name || '');
    const memoKey = `${pk}\0${sk}`;
    let u = directMemo.get(memoKey);
    if (u === undefined) {
      const found = await findDirectThumbnailRuleImageUrl(name, p.store_name || '');
      u = found && isValidResolvedImage(found) ? found : null;
      directMemo.set(memoKey, u);
    }
    if (u) {
      p.promo_image_url = u;
      upsertByNormKey.set(pk, { productName: name, url: u });
    }
  }
  if (upsertByNormKey.size) {
    await Promise.all(
      [...upsertByNormKey.values()].map((x) =>
        upsertImageCacheRow(supabase, x.productName, x.url, 'thumbnail_rule')
      )
    );
  }

  const keys = [];
  const keyToPoints = new Map();
  for (const p of points) {
    if (!needsThumbnailEnrichment(p.promo_image_url)) continue;
    const plan = await buildThumbnailImagePlanAsync(p.product_name, p.store_name || '');
    for (const k of plan.cacheLookupKeys) {
      if (!k || k.length < 2) continue;
      if (!keyToPoints.has(k)) {
        keyToPoints.set(k, []);
        keys.push(k);
      }
      keyToPoints.get(k).push(p);
    }
  }
  if (!keys.length) return;

  const chunk = 120;
  for (let i = 0; i < keys.length; i += chunk) {
    const slice = keys.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('map_product_image_cache')
      .select('norm_key, image_url')
      .in('norm_key', slice);
    if (error) {
      console.warn('hydratePointsFromImageCache:', error.message);
      continue;
    }
    for (const row of data || []) {
      const u = row?.image_url;
      if (!u || !isValidResolvedImage(u)) continue;
      const list = keyToPoints.get(row.norm_key);
      if (!list) continue;
      for (const p of list) {
        p.promo_image_url = u;
      }
    }
  }
}

export function quickAddImageResolveEnabled() {
  return process.env.QUICK_ADD_RESOLVE_IMAGE !== '0';
}

export function isGoogleCseEnabledForQuickAdd() {
  return (
    process.env.QUICK_ADD_GOOGLE_CSE === '1' ||
    process.env.MAP_POINTS_GOOGLE_CSE_FALLBACK === '1'
  ) && Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID);
}

/** Memoiza por norm_key dentro de um único request Quick Add (vários produtos iguais). */
export async function resolveThumbnailForQuickAddInsert(supabase, productName, storeName, memo) {
  if (!quickAddImageResolveEnabled()) return null;
  const k = normalizeMapProductImageKey(productName);
  if (!k || k.length < 2) return null;
  if (memo.has(k)) return memo.get(k);

  const { url } = await resolveProductThumbnailUrl(supabase, productName, storeName, {
    useGoogleCse: isGoogleCseEnabledForQuickAdd(),
  });
  memo.set(k, url || null);
  return url || null;
}

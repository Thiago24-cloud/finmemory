/**
 * Cache persistente de miniatura por nome de produto (mapa).
 * Ordem: BD → Open Food Facts → Google CSE (opcional).
 */

import {
  fetchGoogleCseImageByName,
  fetchOpenFoodFactsImageByName,
  isValidResolvedImage,
} from './externalProductImages';
import { needsThumbnailEnrichment } from './enrichMapPointImages';

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

export async function upsertImageCacheRow(supabase, productName, imageUrl, source = 'resolver') {
  const normKey = normalizeMapProductImageKey(productName);
  if (!normKey || normKey.length < 2 || !imageUrl || !isValidResolvedImage(imageUrl)) return false;
  const display = String(productName || '').trim().slice(0, 280);
  const { error } = await supabase.from('map_product_image_cache').upsert(
    {
      norm_key: normKey,
      display_name: display || normKey,
      image_url: String(imageUrl).trim(),
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

  const cached = await getCachedImageUrlFromDb(supabase, productName);
  if (cached) return { url: cached, source: 'cache' };

  let url = await fetchOpenFoodFactsImageByName(productName);
  let src = 'openfoodfacts';
  if (!url && useGoogleCse) {
    url = await fetchGoogleCseImageByName(productName, storeName || '');
    src = 'google_cse';
  }
  if (!url) return { url: null, source: null };

  await upsertImageCacheRow(supabase, productName, url, src);
  return { url, source: src };
}

/**
 * Preenche promo_image_url a partir do cache em lote (uma query).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ product_name: string, promo_image_url?: string|null }>} points
 */
export async function hydratePointsFromImageCache(supabase, points) {
  if (!supabase || !Array.isArray(points) || !points.length) return;

  const keys = [];
  const keyToPoints = new Map();
  for (const p of points) {
    if (!needsThumbnailEnrichment(p.promo_image_url)) continue;
    const k = normalizeMapProductImageKey(p.product_name);
    if (!k || k.length < 2) continue;
    if (!keyToPoints.has(k)) {
      keyToPoints.set(k, []);
      keys.push(k);
    }
    keyToPoints.get(k).push(p);
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

export function useGoogleCseForQuickAdd() {
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
    useGoogleCse: useGoogleCseForQuickAdd(),
  });
  memo.set(k, url || null);
  return url || null;
}

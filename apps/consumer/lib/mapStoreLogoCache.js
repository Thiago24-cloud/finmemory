/**
 * Cache persistente de logotipo por nome de loja (mapa).
 * @see supabase/migrations/20260412130000_map_store_logo_cache.sql
 */

import { isValidResolvedImage } from './externalProductImages';
import { normalizeStoreNameForLogoMatch } from './storeLogos';

/**
 * Mesma regra que `nameMatchesKey` em storeLogos.js (substring / palavra inteira).
 * @param {string} lower resultado de normalizeStoreNameForLogoMatch(storeName)
 * @param {string} k norm_key já normalizado
 */
function nameMatchesKey(lower, k) {
  if (!k) return false;
  if (lower === k) return true;
  if (k.length >= 5) return lower.includes(k);
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(lower);
}

/**
 * @param {string} storeName nome da loja como em public.stores.name
 * @param {Array<{ norm_key: string, image_url: string, updated_at?: string }>} rows
 * @returns {string | null}
 */
export function pickStoreLogoFromCacheRows(storeName, rows) {
  if (!storeName || !Array.isArray(rows) || rows.length === 0) return null;
  const lower = normalizeStoreNameForLogoMatch(storeName);
  if (!lower) return null;
  const sorted = [...rows].sort(
    (a, b) => String(b.norm_key || '').length - String(a.norm_key || '').length
  );
  for (const row of sorted) {
    const k = String(row.norm_key || '').trim();
    if (!k || !nameMatchesKey(lower, k)) continue;
    const u = String(row.image_url || '').trim();
    if (u && isValidResolvedImage(u)) {
      const ts = row.updated_at ? String(row.updated_at).replace(/\D/g, '').slice(0, 14) : '';
      if (ts) {
        const sep = u.includes('?') ? '&' : '?';
        return `${u}${sep}v=${ts}`;
      }
      return u;
    }
  }
  return null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} storeName texto que o operador colou (ex.: nome da loja no cadastro)
 * @param {string} imageUrl https
 * @param {string} [source]
 */
export async function upsertStoreLogoCacheRow(supabase, storeName, imageUrl, source = 'quick_add') {
  const normKey = normalizeStoreNameForLogoMatch(storeName);
  if (!normKey || normKey.length < 2 || !imageUrl || !isValidResolvedImage(imageUrl)) return false;
  const display = String(storeName || '').trim().slice(0, 280);
  const src = String(source || 'quick_add').slice(0, 64);

  let existing = null;
  let lockColumnReadable = true;
  const { data: ex, error: readErr } = await supabase
    .from('map_store_logo_cache')
    .select('manual_locked')
    .eq('norm_key', normKey)
    .maybeSingle();
  if (readErr) {
    if (/manual_locked|column|does not exist/i.test(readErr.message || '')) lockColumnReadable = false;
    else console.warn('map_store_logo_cache read:', readErr.message);
  } else {
    existing = ex;
  }
  if (lockColumnReadable && existing?.manual_locked && src !== 'manual_url') {
    return true;
  }
  const manualLocked =
    src === 'manual_url' ? true : lockColumnReadable ? !!existing?.manual_locked : false;

  const row = {
    norm_key: normKey,
    display_name: display || normKey,
    image_url: String(imageUrl).trim(),
    source: src,
    updated_at: new Date().toISOString(),
    manual_locked: manualLocked,
  };

  const { error } = await supabase.from('map_store_logo_cache').upsert(row, { onConflict: 'norm_key' });
  if (error) {
    if (/manual_locked|column/i.test(error.message || '')) {
      const { manual_locked: _m, ...rest } = row;
      const { error: err2 } = await supabase.from('map_store_logo_cache').upsert(rest, { onConflict: 'norm_key' });
      if (err2) {
        console.warn('map_store_logo_cache upsert:', err2.message);
        return false;
      }
      return true;
    }
    console.warn('map_store_logo_cache upsert:', error.message);
    return false;
  }
  return true;
}

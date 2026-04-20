/**
 * Supressões de pin (coordenada errada): filtro no GET /api/map/stores e gravação via remove-store-from-map.
 * @see supabase/migrations/20260412230000_map_pin_suppression_logo_lock.sql
 */

import { normalizeStoreNameMatchKey } from './mapStoreNameNormalize';

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function fetchActiveMapPinSuppressions(supabase) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('map_pin_location_suppressions')
    .select('store_norm_key_js, center_lat, center_lng, radius_m, expires_at')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (error) {
    if (/relation|does not exist|map_pin_location_suppressions/i.test(error.message || '')) {
      return [];
    }
    console.warn('map_pin_location_suppressions:', error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

/**
 * @param {{ name?: string, lat?: unknown, lng?: unknown }} store
 * @param {Array<{ store_norm_key_js?: string, center_lat?: unknown, center_lng?: unknown, radius_m?: unknown }>} suppressions
 */
export function isStoreRowSuppressedByPinRules(store, suppressions) {
  if (!store || !Array.isArray(suppressions) || suppressions.length === 0) return false;
  const key = normalizeStoreNameMatchKey(store.name);
  if (!key) return false;
  const sLat = Number(store.lat);
  const sLng = Number(store.lng);
  if (Number.isNaN(sLat) || Number.isNaN(sLng)) return false;
  for (const sup of suppressions) {
    const supKey = String(sup.store_norm_key_js || '').trim();
    if (!supKey || supKey !== key) continue;
    const cLat = Number(sup.center_lat);
    const cLng = Number(sup.center_lng);
    let rad = Number(sup.radius_m);
    if (!Number.isFinite(rad) || rad <= 0) rad = 280;
    rad = Math.min(Math.max(rad, 50), 5000);
    if (Number.isNaN(cLat) || Number.isNaN(cLng)) continue;
    const dM = distanceKm(sLat, sLng, cLat, cLng) * 1000;
    if (dM <= rad) return true;
  }
  return false;
}

/**
 * Nome normalizado como em find_or_create_store (SQL). Falha silenciosa → null.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} displayName
 * @returns {Promise<string | null>}
 */
export async function resolveStoreNormSql(supabase, displayName) {
  const raw = String(displayName || '').trim();
  if (raw.length < 2) return null;
  try {
    const { data, error } = await supabase.rpc('normalize_store_name_for_match', { input: raw });
    if (error) {
      console.warn('normalize_store_name_for_match rpc:', error.message);
      return null;
    }
    const s = data == null ? '' : String(data).trim();
    return s.length >= 2 ? s : null;
  } catch (e) {
    console.warn('normalize_store_name_for_match:', e?.message || e);
    return null;
  }
}

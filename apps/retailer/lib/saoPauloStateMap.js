/**
 * Limites do mapa de preços — Estado de São Paulo.
 * Manter alinhado a `apps/consumer/lib/saoPauloStateMap.js` (fonte canônica do ecossistema).
 */

export const SAO_PAULO_CITY_CENTER = Object.freeze([-23.5505, -46.6333]);

export const MAP_DEFAULT_ZOOM = 11;
export const MAP_MIN_ZOOM = 7;
export const MAP_MAX_ZOOM = 19;
export const MAP_MAX_BOUNDS_VISCOSITY = 1;

export const SAO_PAULO_STATE_BOUNDS = Object.freeze({
  minLat: -25.5,
  maxLat: -19.5,
  minLng: -53.0,
  maxLng: -44.0,
});

/** Leaflet `maxBounds`: [[latSW, lngSW], [latNE, lngNE]]. */
export const SAO_PAULO_STATE_MAX_BOUNDS = Object.freeze([
  [SAO_PAULO_STATE_BOUNDS.minLat, SAO_PAULO_STATE_BOUNDS.minLng],
  [SAO_PAULO_STATE_BOUNDS.maxLat, SAO_PAULO_STATE_BOUNDS.maxLng],
]);

export function isInsideSaoPauloState(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  const b = SAO_PAULO_STATE_BOUNDS;
  return la >= b.minLat && la <= b.maxLat && lo >= b.minLng && lo <= b.maxLng;
}

/** Mantém centro dentro do estado; fora de SP volta à capital. */
export function clampCenterToSaoPaulo(lat, lng) {
  if (isInsideSaoPauloState(lat, lng)) return [Number(lat), Number(lng)];
  return [...SAO_PAULO_CITY_CENTER];
}

/**
 * Recorta bbox à área operacional (mesmo contrato do consumer).
 * @param {{ sw_lat: number, sw_lng: number, ne_lat: number, ne_lng: number }} bbox
 */
export function clampBboxToSaoPauloState(bbox) {
  if (!bbox || typeof bbox !== 'object') return null;
  const b = SAO_PAULO_STATE_BOUNDS;
  const sw_lat = Math.max(b.minLat, Number(bbox.sw_lat));
  const sw_lng = Math.max(b.minLng, Number(bbox.sw_lng));
  const ne_lat = Math.min(b.maxLat, Number(bbox.ne_lat));
  const ne_lng = Math.min(b.maxLng, Number(bbox.ne_lng));
  if (sw_lat >= ne_lat || sw_lng >= ne_lng) return null;
  return { sw_lat, sw_lng, ne_lat, ne_lng };
}

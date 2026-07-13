/**
 * Limites do mapa de preços — Estado de São Paulo (mesmos valores do app consumidor).
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

/**
 * Viewport e limites do mapa de preços (escala Estado de São Paulo).
 * Fonte única para Leaflet (MapaPrecos) e heurísticas de API por bbox.
 */

/** Centro da cidade de São Paulo (capital) — vista inicial do mapa. */
export const SAO_PAULO_CITY_CENTER = Object.freeze([-23.5505, -46.6333]);

/** Zoom inicial: região metropolitana em torno da capital. */
export const MAP_DEFAULT_ZOOM = 11;

/** Impede zoom out além do território paulista (não ver Brasil/oceano). */
export const MAP_MIN_ZOOM = 7;

/** Detalhe ao nível da rua. */
export const MAP_MAX_ZOOM = 19;

/** Rebatimento total ao arrastar para fora do estado (Leaflet maxBoundsViscosity). */
export const MAP_MAX_BOUNDS_VISCOSITY = 1;

/**
 * Bounding box do Estado de São Paulo (WGS84, aproximado).
 * Sudoeste / nordeste conforme operação FinMemory em SP.
 */
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

/** @deprecated Preferir SAO_PAULO_CITY_CENTER para o mapa; mantido para compat. */
export const SAO_PAULO_STATE_CENTER = SAO_PAULO_CITY_CENTER;

/** @deprecated Preferir MAP_MIN_ZOOM. */
export const SAO_PAULO_STATE_ZOOM = MAP_MIN_ZOOM;

/**
 * Viewport “grande” (estado / macro-região): APIs podem subir limites de linhas por bbox.
 * Heurística: metade ou mais da extensão típica do estado em lat OU lng.
 */
/** Leaflet `LatLngBounds` a partir de `SAO_PAULO_STATE_MAX_BOUNDS` (só no browser). */
export function saoPauloStateLatLngBounds(L) {
  if (!L?.latLngBounds) return null;
  return L.latLngBounds(SAO_PAULO_STATE_MAX_BOUNDS);
}

/**
 * Recorta um bbox de busca/geocode à área operacional (SP).
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

export function bboxIsStateOrMacroRegion(bbox) {
  if (!bbox || typeof bbox !== 'object') return false;
  const latSpan = Math.abs(bbox.maxLat - bbox.minLat);
  const lngSpan = Math.abs(bbox.maxLng - bbox.minLng);
  return latSpan >= 2.0 || lngSpan >= 3.0;
}

/**
 * Mapa de preços em escala do Estado de São Paulo (viewport inicial + heurística de API).
 * Limites administrativos são aproximados (bbox ~ WGS84).
 */

/** Centro aproximado do estado (interior entre capital e Campinas). */
export const SAO_PAULO_STATE_CENTER = Object.freeze([-22.55, -48.62]);

/** Zoom Leaflet que mostra praticamente todo o território paulista. */
export const SAO_PAULO_STATE_ZOOM = 7;

export const SAO_PAULO_STATE_BOUNDS = Object.freeze({
  minLat: -25.38,
  maxLat: -19.78,
  minLng: -53.2,
  maxLng: -44.05,
});

/**
 * Viewport “grande” (estado / macro-região): APIs podem subir limites de linhas por bbox.
 * Heurística: metade ou mais da extensão típica do estado em lat OU lng.
 */
export function bboxIsStateOrMacroRegion(bbox) {
  if (!bbox || typeof bbox !== 'object') return false;
  const latSpan = Math.abs(bbox.maxLat - bbox.minLat);
  const lngSpan = Math.abs(bbox.maxLng - bbox.minLng);
  return latSpan >= 2.0 || lngSpan >= 3.0;
}

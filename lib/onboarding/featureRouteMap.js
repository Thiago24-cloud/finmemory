/**
 * Registra visita a uma rota → featureId (coach journey).
 */

/** @type {Record<string, string>} */
export const ROUTE_TO_FEATURE_ID = {
  '/mapa': 'mapa',
  '/add-receipt': 'scan',
  '/scan-product': 'barcode',
  '/missoes': 'missoes',
  '/simulador': 'simulador',
  '/reports': 'extrato',
  '/dashboard': 'dashboard',
};

/**
 * @param {string | undefined} pathname
 * @returns {string | null}
 */
export function featureIdFromRoute(pathname) {
  if (!pathname) return null;
  if (ROUTE_TO_FEATURE_ID[pathname]) return ROUTE_TO_FEATURE_ID[pathname];
  return null;
}

/**
 * Mapa aberto a partir do app Parceiros (?from=parceiros) — tela cheia, sem chrome do consumidor.
 */
export function isParceirosMapView(router) {
  if (!router?.isReady) return false;
  const path = String(router.pathname || '').replace(/\/$/, '') || '/';
  return path === '/mapa' && router.query?.from === 'parceiros';
}

/**
 * URL do app consumidor (mapa de preços). No retailer, NEXT_PUBLIC_APP_URL aponta para o próprio host.
 */
export function getConsumerAppBaseUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_CONSUMER_APP_URL ||
    process.env.NEXT_PUBLIC_FINMEMORY_CONSUMER_URL ||
    '';
  const base = (fromEnv || 'https://finmemory.com.br').replace(/\/$/, '');
  return base;
}

/**
 * Mapa público embutível (mapa-precos) com foco opcional na loja.
 * @param {{ lat?: number|null, lng?: number|null, zoom?: number }} opts
 */
export function buildConsumerPublicMapUrl({ lat, lng, zoom = 16 } = {}) {
  const params = new URLSearchParams({ embed: '1' });
  const latN = Number(lat);
  const lngN = Number(lng);
  if (Number.isFinite(latN) && Number.isFinite(lngN)) {
    params.set('lat', String(latN));
    params.set('lng', String(lngN));
    params.set('zoom', String(zoom));
  }
  return `${getConsumerAppBaseUrl()}/mapa-precos?${params.toString()}`;
}

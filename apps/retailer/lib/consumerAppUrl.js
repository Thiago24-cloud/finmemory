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
 * Mapa oficial do consumidor (/mapa) — mesma rota, pins e promoções do app FinMemory.
 * @param {{ lat?: number|null, lng?: number|null, zoom?: number, from?: string, embed?: boolean, lista?: string|string[], cesta?: string, cestaMin?: number }} opts
 */
export function buildConsumerMapUrl({
  lat,
  lng,
  zoom = 16,
  from = 'parceiros',
  embed = false,
  lista,
  cesta,
  cestaMin,
} = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (embed) params.set('embed', '1');
  if (lista) {
    const raw = Array.isArray(lista) ? lista.join(',') : String(lista);
    const trimmed = raw.trim();
    if (trimmed) params.set('lista', trimmed);
  }
  if (cesta) {
    params.set('cesta', String(cesta).trim());
  }
  if (cestaMin != null && Number.isFinite(Number(cestaMin))) {
    params.set('cesta_min', String(Math.round(Number(cestaMin))));
  }
  const latN = Number(lat);
  const lngN = Number(lng);
  if (Number.isFinite(latN) && Number.isFinite(lngN)) {
    params.set('lat', String(latN));
    params.set('lng', String(lngN));
    params.set('zoom', String(zoom));
  }
  const qs = params.toString();
  return `${getConsumerAppBaseUrl()}/mapa${qs ? `?${qs}` : ''}`;
}

/** @deprecated Use buildConsumerMapUrl */
export function buildConsumerPublicMapUrl(opts) {
  return buildConsumerMapUrl(opts);
}

import { buildConsumerMapUrl } from '../../consumerAppUrl';
import { buildGoogleMapsMultiStopUrl } from './googleMapsMultiStop.js';

export function encodeCestaMapParam(payload) {
  const json = JSON.stringify(payload);
  if (typeof window !== 'undefined') {
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  return Buffer.from(json, 'utf8').toString('base64url');
}

/**
 * @param {Array} stores — saída de computeStoreTotalsForCestaItems
 * @param {{ total?: number }} summary
 */
export function buildCestaMapPayload(stores, summary) {
  const totalItems = Number(summary?.total) || Number(stores?.[0]?.totalItems) || 0;
  return {
    v: 1,
    T: totalItems,
    min: 1,
    s: (stores || []).slice(0, 15).map((st) => {
      const lat = Number(st.lat);
      const lng = Number(st.lng);
      const row = {
        n: st.storeName,
        t: st.total,
        c: st.coveredItems,
        T: st.totalItems,
        p: st.coveragePct,
      };
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        row.a = lat;
        row.o = lng;
      }
      return row;
    }),
  };
}

/** Paradas ordenadas (melhor cobertura → menor total) com coordenadas. */
export function pickCestaRouteStops(stores, { maxStops = 5 } = {}) {
  return (stores || [])
    .filter((st) => Number.isFinite(Number(st.lat)) && Number.isFinite(Number(st.lng)))
    .slice(0, Math.max(1, Math.min(10, maxStops)))
    .map((st) => ({
      name: st.storeName,
      lat: Number(st.lat),
      lng: Number(st.lng),
      total: st.total,
      coveragePct: st.coveragePct,
    }));
}

/**
 * URL Google Maps: origem = loja do lojista, paradas = mercados da cesta.
 */
export function buildCestaGoogleMapsRouteUrl({ stores = [], storeLat, storeLng, maxStops = 5 } = {}) {
  const stops = pickCestaRouteStops(stores, { maxStops });
  if (!stops.length) return null;
  const originLat = Number(storeLat);
  const originLng = Number(storeLng);
  const origin =
    Number.isFinite(originLat) && Number.isFinite(originLng)
      ? { lat: originLat, lng: originLng }
      : null;
  return buildGoogleMapsMultiStopUrl(origin, stops, 'driving');
}

/**
 * URL do mapa consumidor com cesta filtrada e totais por mercado.
 */
export function buildCestaConsumerMapUrl({
  items = [],
  stores = [],
  summary = null,
  storeLat,
  storeLng,
  minCoverage = 1,
  zoom = 14,
  rota = true,
} = {}) {
  const lista = items
    .map((i) => (typeof i === 'string' ? i : i?.nome))
    .filter(Boolean)
    .join(',');

  const payload = buildCestaMapPayload(stores, summary);
  payload.min = minCoverage;
  const routeStops = pickCestaRouteStops(stores, { maxStops: 5 });
  if (routeStops.length) payload.r = 1;

  const opts = {
    from: 'parceiros',
    embed: true,
    lista,
    cesta: encodeCestaMapParam(payload),
    cestaMin: minCoverage,
    rota: rota && routeStops.length > 0 ? true : undefined,
  };

  const latN = Number(storeLat);
  const lngN = Number(storeLng);
  if (Number.isFinite(latN) && Number.isFinite(lngN)) {
    opts.lat = latN;
    opts.lng = lngN;
    opts.zoom = zoom;
  }

  return buildConsumerMapUrl(opts);
}

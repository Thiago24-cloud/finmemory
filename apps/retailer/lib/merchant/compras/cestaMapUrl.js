import { buildConsumerMapUrl } from '../../consumerAppUrl';

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
    s: (stores || []).slice(0, 15).map((st) => ({
      n: st.storeName,
      t: st.total,
      c: st.coveredItems,
      T: st.totalItems,
      p: st.coveragePct,
    })),
  };
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
} = {}) {
  const lista = items
    .map((i) => (typeof i === 'string' ? i : i?.nome))
    .filter(Boolean)
    .join(',');

  const payload = buildCestaMapPayload(stores, summary);
  payload.min = minCoverage;

  const opts = {
    from: 'parceiros',
    embed: true,
    lista,
    cesta: encodeCestaMapParam(payload),
    cestaMin: minCoverage,
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

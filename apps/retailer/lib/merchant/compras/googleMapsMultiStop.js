/**
 * URL Google Maps com várias paradas (origem → waypoints → destino).
 * Espelho leve de apps/consumer/lib/mapDirections.js para o app Parceiros.
 */

function toPair(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return { la, ln };
}

/**
 * @param {{ lat: number, lng: number } | null} origin
 * @param {Array<{ lat: number, lng: number }>} stops
 * @param {'driving'|'walking'|'bicycling'|'transit'} [travelMode]
 */
export function buildGoogleMapsMultiStopUrl(origin, stops, travelMode = 'driving') {
  const pts = (Array.isArray(stops) ? stops : [])
    .map((s) => toPair(s?.lat, s?.lng))
    .filter(Boolean);
  if (!pts.length) return null;

  const params = new URLSearchParams({
    api: '1',
    travelmode: travelMode,
  });

  const o = origin && toPair(origin.lat, origin.lng);
  if (o) params.set('origin', `${o.la},${o.ln}`);

  if (pts.length === 1) {
    params.set('destination', `${pts[0].la},${pts[0].ln}`);
  } else {
    const dest = pts[pts.length - 1];
    const mid = pts.slice(0, -1);
    params.set('destination', `${dest.la},${dest.ln}`);
    if (mid.length) {
      params.set('waypoints', mid.map((p) => `${p.la},${p.ln}`).join('|'));
    }
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

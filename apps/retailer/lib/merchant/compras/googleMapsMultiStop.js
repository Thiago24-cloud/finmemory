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

const GEO_OPTS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 120000,
});

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

/** Abre rota no Google Maps com origem conhecida ou geolocalização do navegador. */
export function openGoogleMapsDirectionsPreferCurrentLocation(
  dest,
  knownOrigin = null,
  travelMode = 'driving'
) {
  if (typeof window === 'undefined') return;
  const d = toPair(dest.lat, dest.lng);
  if (!d) return;

  const openWithQueryOrigin = (la, ln) => {
    const params = new URLSearchParams({
      api: '1',
      origin: `${la},${ln}`,
      destination: `${d.la},${d.ln}`,
      travelmode: travelMode,
    });
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const openFromCurrentLocationPath = () => {
    const destSeg = `${d.la},${d.ln}`;
    const url = `https://www.google.com/maps/dir/${encodeURIComponent('Current Location')}/${encodeURIComponent(destSeg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const ko = knownOrigin && toPair(knownOrigin.lat, knownOrigin.lng);
  if (ko) {
    openWithQueryOrigin(ko.la, ko.ln);
    return;
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    openFromCurrentLocationPath();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => openWithQueryOrigin(pos.coords.latitude, pos.coords.longitude),
    () => openFromCurrentLocationPath(),
    GEO_OPTS
  );
}

/** Abre o Waze até o ponto (comum no Brasil). */
export function openWazeNavigation(dest) {
  if (typeof window === 'undefined') return;
  const d = toPair(dest.lat, dest.lng);
  if (!d) return;
  const url = `https://waze.com/ul?ll=${encodeURIComponent(`${d.la},${d.ln}`)}&navigate=yes`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

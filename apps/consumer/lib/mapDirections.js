/**
 * Ligações para navegação externa (padrão Google Maps / Waze).
 * @see https://developers.google.com/maps/documentation/urls/get-started
 */

function toPair(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return { la, ln };
}

/**
 * Abre trajeto até o destino. Se `origin` existir, a rota parte da posição atual no Finmemory Maps.
 * @param {{ lat: number, lng: number }} dest
 * @param {{ lat?: number, lng?: number } | null} [origin] — última posição obtida em "Minha localização"
 * @param {'driving'|'walking'|'bicycling'|'transit'} [travelMode]
 */
export function openGoogleMapsDirections(dest, origin = null, travelMode = 'driving') {
  if (typeof window === 'undefined') return;
  const d = toPair(dest.lat, dest.lng);
  if (!d) return;
  const params = new URLSearchParams({
    api: '1',
    destination: `${d.la},${d.ln}`,
    travelmode: travelMode,
  });
  const o = origin && toPair(origin.lat, origin.lng);
  if (o) {
    params.set('origin', `${o.la},${o.ln}`);
  }
  const url = `https://www.google.com/maps/dir/?${params.toString()}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

const GEO_OPTS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 120000,
});

/**
 * Abre rota no Google Maps priorizando origem “aqui”, como o app do Maps.
 * 1) Se `knownOrigin` tiver coords, usa-as.
 * 2) Senão tenta `navigator.geolocation` no clique (permissão).
 * 3) Se falhar, URL com segmento `Current Location` → o Maps usa a posição do utilizador.
 */
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
    (pos) => {
      openWithQueryOrigin(pos.coords.latitude, pos.coords.longitude);
    },
    () => {
      openFromCurrentLocationPath();
    },
    GEO_OPTS
  );
}

/** Abre o Waze direto na navegação até o ponto (comum no Brasil). */
export function openWazeNavigation(dest) {
  if (typeof window === 'undefined') return;
  const d = toPair(dest.lat, dest.lng);
  if (!d) return;
  const url = `https://waze.com/ul?ll=${encodeURIComponent(`${d.la},${d.ln}`)}&navigate=yes`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Waze por texto de endereço (URL web; em mobile costuma abrir o app Waze). */
export function openWazeSearchByAddress(address) {
  if (typeof window === 'undefined') return;
  const q = String(address || '').trim();
  if (!q) return;
  const enc = encodeURIComponent(q);
  window.open(`https://waze.com/ul?q=${enc}`, '_blank', 'noopener,noreferrer');
}

/** Google Maps — pesquisa por endereço (abrir o local). */
export function openGoogleMapsSearchQuery(query) {
  if (typeof window === 'undefined') return;
  const q = String(query || '').trim();
  if (!q) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

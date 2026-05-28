/**
 * Geocoding via Mapbox Geocoding API (não Google). Cache de place_id no Supabase
 * seria extensão futura para reduzir chamadas repetidas à mesma loja.
 * Converte nome do estabelecimento + cidade/país em lat/lng para o mapa.
 * @param {string} query - Ex: "Drogasil, São Paulo, Brasil"
 * @returns {{ lat: number, lng: number } | null}
 */
export async function geocodeAddress(query, options = {}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !query || String(query).trim().length < 2) return null;

  const q = encodeURIComponent(String(query).trim());
  const params = new URLSearchParams({
    access_token: token,
    limit: '1',
    country: 'BR',
  });
  if (options.bbox) params.set('bbox', options.bbox);
  if (options.proximity?.lng != null && options.proximity?.lat != null) {
    params.set('proximity', `${options.proximity.lng},${options.proximity.lat}`);
  }
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?${params}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features && data.features[0];
    if (!feature || !feature.center || feature.center.length < 2) return null;
    const [lng, lat] = feature.center;
    return { lat: Number(lat), lng: Number(lng) };
  } catch (e) {
    console.warn('Geocode error:', e.message);
    return null;
  }
}

/** Grande SP — evita geocode em outra cidade com nome de rua parecido (ex. Pompéia). */
export const GRANDE_SP_GEOCODE_BBOX = '-47.15,-24.05,-46.0,-23.15';
export const SAO_PAULO_CITY_PROXIMITY = { lng: -46.6333, lat: -23.5505 };

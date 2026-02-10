/**
 * Geocoding via Mapbox Geocoding API.
 * Converte nome do estabelecimento + cidade/país em lat/lng para o mapa.
 * @param {string} query - Ex: "Drogasil, São Paulo, Brasil"
 * @returns {{ lat: number, lng: number } | null}
 */
export async function geocodeAddress(query) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !query || String(query).trim().length < 2) return null;

  const q = encodeURIComponent(String(query).trim());
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${token}&limit=1&country=BR`;

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

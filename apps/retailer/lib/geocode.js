/**
 * Geocoding via Mapbox (cadastro parceiros, lojas no mapa).
 */
export const GRANDE_SP_GEOCODE_BBOX = '-47.15,-24.05,-46.0,-23.15';
export const SAO_PAULO_CITY_PROXIMITY = { lng: -46.6333, lat: -23.5505 };

/**
 * @param {string} query
 * @param {{ bbox?: string, proximity?: { lng: number, lat: number }, limit?: number }} [options]
 */
export async function geocodeAddress(query, options = {}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !query || String(query).trim().length < 2) return null;

  const q = encodeURIComponent(String(query).trim());
  const params = new URLSearchParams({
    access_token: token,
    limit: String(options.limit ?? 1),
    country: 'BR',
    language: 'pt',
  });
  if (options.bbox) params.set('bbox', options.bbox);
  if (options.proximity?.lng != null && options.proximity?.lat != null) {
    params.set('proximity', `${options.proximity.lng},${options.proximity.lat}`);
  }
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?${params}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature?.center || feature.center.length < 2) return null;
    const [lng, lat] = feature.center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: Number(lat), lng: Number(lng) };
  } catch (e) {
    console.warn('Geocode error:', e?.message || e);
    return null;
  }
}

function hasCityOrStateHint(text) {
  return /\b(SP|RJ|MG|PR|RS|SC|ES|BA|CE|PE|GO|DF|AM|PA|MA|MT|MS|RN|PB|AL|SE|RO|AC|AP|RR|TO|PI|CE)\b/i.test(
    text
  ) || /\b(são paulo|sao paulo|rio de janeiro|belo horizonte|curitiba|porto alegre)\b/i.test(
    text
  );
}

function buildAddressQueries(address, addressComplement) {
  const street = String(address || '').trim();
  const comp = String(addressComplement || '').trim();
  const queries = [];
  if (comp) {
    queries.push(`${street}, ${comp}, Brasil`);
    queries.push(`${street}, complemento ${comp}, Brasil`);
  }
  queries.push(`${street}, Brasil`);
  if (!hasCityOrStateHint(street)) {
    queries.push(`${street}, São Paulo, SP, Brasil`);
    queries.push(`Rua ${street.replace(/^rua\s+/i, '')}, Brasil`);
  }
  return [...new Set(queries)];
}

/**
 * Geocodifica endereço de loja com várias tentativas (rua sem cidade, complemento, etc.).
 * @param {string} address
 * @param {string} [addressComplement]
 */
export async function geocodePartnerStoreAddress(address, addressComplement = '') {
  const geoOpts = { bbox: GRANDE_SP_GEOCODE_BBOX, proximity: SAO_PAULO_CITY_PROXIMITY, limit: 3 };
  for (const q of buildAddressQueries(address, addressComplement)) {
    const coords = await geocodeAddress(q, geoOpts);
    if (coords?.lat && coords?.lng) return coords;
  }
  return null;
}

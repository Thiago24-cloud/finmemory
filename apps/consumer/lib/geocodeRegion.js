/**
 * Termos que o Mapbox resolve para cidade/POI fora de SP mas no mapa o utilizador
 * quase sempre quer filtrar produto/loja (ex.: “padrão” → rede Supermercado Padrão).
 * Devolver null força a UI a usar busca textual em /api/map/points?q=…
 */
function shouldSkipRegionGeocode(query) {
  const n = String(query || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!n) return false;
  if (n === 'padr' || n === 'padra' || n === 'padrao') return true;
  if (n === 'supermercado padrao' || n === 'mercado padrao') return true;
  /* Mapbox devolve “Mambo” como lugar no PR — no app quase sempre é a rede. */
  if (n === 'mamb' || n === 'mambo') return true;
  if (n === 'supermercado mambo' || n === 'mercado mambo') return true;
  return false;
}

/**
 * Geocodifica nome de bairro, cidade ou região (Brasil) via Mapbox Places.
 * Usado para “buscar por região” no mapa — não confundir com busca de produto.
 *
 * @param {string} query
 * @returns {Promise<{ center: { lat: number, lng: number }, bbox: { sw_lat: number, sw_lng: number, ne_lat: number, ne_lng: number }, label: string } | null>}
 */
export async function geocodeRegionQuery(query) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const q = String(query || '').trim();
  if (!token || q.length < 2) return null;
  if (shouldSkipRegionGeocode(q)) return null;

  const encoded = encodeURIComponent(q);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&limit=1&country=BR&types=region,postcode,district,place,locality,neighborhood&proximity=-46.6333,-23.5505&language=pt`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features && data.features[0];
    if (!feature || !feature.center || feature.center.length < 2) return null;

    const rel = typeof feature.relevance === 'number' ? feature.relevance : 0;
    if (rel < 0.42) return null;

    const [lng, lat] = feature.center;
    let minLng;
    let minLat;
    let maxLng;
    let maxLat;

    if (Array.isArray(feature.bbox) && feature.bbox.length === 4) {
      [minLng, minLat, maxLng, maxLat] = feature.bbox;
    } else {
      const pad = 0.045;
      minLat = lat - pad;
      maxLat = lat + pad;
      minLng = lng - pad;
      maxLng = lng + pad;
    }

    const minSpan = 0.012;
    if (maxLat - minLat < minSpan) {
      const mid = (minLat + maxLat) / 2;
      minLat = mid - minSpan / 2;
      maxLat = mid + minSpan / 2;
    }
    if (maxLng - minLng < minSpan) {
      const mid = (minLng + maxLng) / 2;
      minLng = mid - minSpan / 2;
      maxLng = mid + minSpan / 2;
    }

    const label = feature.place_name || feature.text || q;
    return {
      center: { lat, lng },
      bbox: {
        sw_lat: minLat,
        sw_lng: minLng,
        ne_lat: maxLat,
        ne_lng: maxLng,
      },
      label,
    };
  } catch (e) {
    console.warn('geocodeRegionQuery:', e.message);
    return null;
  }
}

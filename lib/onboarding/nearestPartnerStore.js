/**
 * Escolhe a loja parceira mais próxima a partir de ofertas / lista de lojas.
 */

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * @param {number} userLat
 * @param {number} userLng
 * @param {Array<Record<string, unknown>>} items — linhas de produtos_oferta_proximos
 */
export function pickNearestStoreFromOfferRows(userLat, userLng, items) {
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng) || !Array.isArray(items)) {
    return null;
  }
  const byStore = new Map();
  for (const row of items) {
    const lat = Number(row.lat ?? row.latitude);
    const lng = Number(row.lng ?? row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const storeId = row.loja_id != null ? String(row.loja_id) : null;
    const name = String(row.nome_comercial || row.nome_loja || row.store_name || '').trim();
    const key = storeId || name || `${lat},${lng}`;
    const dist = haversineMeters(userLat, userLng, lat, lng);
    const prev = byStore.get(key);
    if (!prev || dist < prev.distanceM) {
      byStore.set(key, {
        storeId,
        storeName: name || 'Loja parceira',
        lat,
        lng,
        distanceM: dist,
        offerCount: (prev?.offerCount || 0) + 1,
      });
    } else {
      prev.offerCount += 1;
    }
  }
  const sorted = Array.from(byStore.values()).sort((a, b) => a.distanceM - b.distanceM);
  return sorted[0] || null;
}

/**
 * @param {number} userLat
 * @param {number} userLng
 * @param {Array<{ id?: string, name?: string, lat?: number, lng?: number, distance_m?: number }>} stores
 */
export function pickNearestStoreFromStoresList(userLat, userLng, stores) {
  if (!Array.isArray(stores) || stores.length === 0) return null;
  let best = null;
  for (const s of stores) {
    const lat = Number(s.lat);
    const lng = Number(s.lng);
    let dist = Number(s.distance_m);
    if (!Number.isFinite(dist) && Number.isFinite(lat) && Number.isFinite(lng)) {
      dist = haversineMeters(userLat, userLng, lat, lng);
    }
    if (!Number.isFinite(dist)) continue;
    if (!best || dist < best.distanceM) {
      best = {
        storeId: s.id != null ? String(s.id) : null,
        storeName: String(s.name || 'Loja').trim() || 'Loja',
        lat,
        lng,
        distanceM: dist,
      };
    }
  }
  return best;
}

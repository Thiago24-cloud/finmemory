/**
 * Mapa embed do painel Parceiros com totais da cesta (Fase 4).
 * Payload compacto via query ?cesta= (base64url JSON).
 */

export function normalizeStoreNameForCestaMatch(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeCestaMapParam(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    let b64 = raw.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json =
      typeof window !== 'undefined'
        ? decodeURIComponent(escape(atob(b64)))
        : Buffer.from(b64, 'base64').toString('utf8');
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * @param {{ s?: Array<{ n: string, t: number, c: number, p: number, T?: number, a?: number, o?: number }>, T?: number, r?: number }} payload
 */
export function buildCestaStoreIndex(payload) {
  const rows = Array.isArray(payload?.s) ? payload.s : [];
  const index = new Map();
  for (const row of rows) {
    const storeName = String(row?.n || '').trim();
    if (!storeName) continue;
    const key = normalizeStoreNameForCestaMatch(storeName);
    if (!key) continue;
    const lat = Number(row.a ?? row.lat);
    const lng = Number(row.o ?? row.lng);
    index.set(key, {
      storeName,
      total: Number(row.t) || 0,
      coveredItems: Number(row.c) || 0,
      totalItems: Number(row.T ?? payload?.T) || 0,
      coveragePct: Number(row.p) || 0,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    });
  }
  return index;
}

/**
 * Paradas da cesta com lat/lng (ordem do payload = ranking da cesta).
 * @param {{ s?: Array }} payload
 * @param {{ maxStops?: number }} [opts]
 */
export function pickCestaRouteStopsFromPayload(payload, { maxStops = 5 } = {}) {
  const rows = Array.isArray(payload?.s) ? payload.s : [];
  const stops = [];
  for (const row of rows) {
    const lat = Number(row?.a ?? row?.lat);
    const lng = Number(row?.o ?? row?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    stops.push({
      name: String(row?.n || 'Mercado').trim() || 'Mercado',
      lat,
      lng,
      total: Number(row?.t) || 0,
      coveragePct: Number(row?.p) || 0,
    });
    if (stops.length >= maxStops) break;
  }
  return stops;
}

/**
 * @param {string} storeName
 * @param {Map<string, object>} storeIndex
 */
export function findCestaMetaForStore(storeName, storeIndex) {
  if (!storeIndex?.size) return null;
  const n = normalizeStoreNameForCestaMatch(storeName);
  if (!n) return null;

  if (storeIndex.has(n)) return storeIndex.get(n);

  for (const [key, meta] of storeIndex.entries()) {
    if (n === key || n.includes(key) || key.includes(n)) return meta;
    const metaNorm = normalizeStoreNameForCestaMatch(meta.storeName);
    if (metaNorm && (n === metaNorm || n.includes(metaNorm) || metaNorm.includes(n))) {
      return meta;
    }
  }
  return null;
}

/**
 * Melhor mercado para destacar no mapa: maior cobertura, depois menor total.
 * @param {Array<{ id: string|number, name?: string }>} storesOnMap
 * @param {Map<string, object>} storeIndex
 */
export function pickCestaHeroStoreId(storesOnMap, storeIndex) {
  if (!storesOnMap?.length || !storeIndex?.size) return null;

  let best = null;
  let bestId = null;

  for (const store of storesOnMap) {
    const meta = findCestaMetaForStore(store.name, storeIndex);
    if (!meta || meta.coveredItems <= 0) continue;
    const score =
      meta.coveragePct * 1000 - meta.total + meta.coveredItems * 0.01;
    if (!best || score > best) {
      best = score;
      bestId = store.id;
    }
  }

  return bestId != null ? String(bestId) : null;
}

export function formatCestaBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

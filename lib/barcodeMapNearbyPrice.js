/**
 * Preço no mapa para leitura de código de barras — oferta mais próxima ou no local da venda.
 */

import { listItemMatchesOfferName, normalizeProductNameForMatch } from './shoppingListMapMatch';

const MAP_SOURCES = [
  'bot_fila_aprovado',
  'admin_manual',
  'scraper_dia',
  'scraper_atacadao',
  'community_manual',
];

/** Utilizador considerado «no ambiente da venda» se estiver a esta distância do pin. */
export const BARCODE_AT_STORE_RADIUS_M = Number(
  process.env.BARCODE_AT_STORE_RADIUS_M || 150
);

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ttlCutoffs() {
  const normalH = Number.parseInt(process.env.MAP_DEFAULT_TTL_HOURS || '24', 10) || 24;
  const promoH = Number.parseInt(process.env.MAP_PROMO_TTL_HOURS || '168', 10) || 168;
  const now = Date.now();
  return {
    normal: new Date(now - normalH * 3600 * 1000).toISOString(),
    promo: new Date(now - promoH * 3600 * 1000).toISOString(),
  };
}

function isActiveRow(row, cutoffs) {
  const created = row.created_at ? new Date(row.created_at).getTime() : 0;
  const isPromo = String(row.category || '').toLowerCase().includes('promo');
  const cutoff = isPromo ? new Date(cutoffs.promo).getTime() : new Date(cutoffs.normal).getTime();
  return created >= cutoff;
}

function sanitizeIlike(s) {
  return String(s || '')
    .trim()
    .slice(0, 60)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ gtin?: string, productName?: string }} params
 */
export async function fetchActiveMapOffersForProduct(supabase, { gtin, productName }) {
  if (!supabase) return [];
  const cutoffs = ttlCutoffs();
  const collected = new Map();

  const pushRows = (rows) => {
    for (const row of rows || []) {
      if (!row?.id) continue;
      if (!isActiveRow(row, cutoffs)) continue;
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const price = Number(row.price);
      if (!Number.isFinite(price) || price <= 0) continue;
      if (row.source && !MAP_SOURCES.includes(row.source) && row.source !== 'legado') continue;
      collected.set(row.id, {
        id: row.id,
        store_name: row.store_name || '',
        product_name: row.product_name || '',
        price,
        lat,
        lng,
        category: row.category || null,
        product_id: row.product_id || null,
      });
    }
  };

  if (gtin) {
    const { data: prod } = await supabase
      .from('products')
      .select('id, name')
      .eq('gtin', gtin)
      .maybeSingle();

    if (prod?.id) {
      const { data: byId } = await supabase
        .from('price_points')
        .select('id, store_name, product_name, price, lat, lng, created_at, category, source, product_id')
        .eq('product_id', prod.id)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .limit(80);
      pushRows(byId);
    }
  }

  const name = String(productName || '').trim();
  if (name.length >= 3) {
    const safe = sanitizeIlike(name);
    const { data: byName } = await supabase
      .from('price_points')
      .select('id, store_name, product_name, price, lat, lng, created_at, category, source, product_id')
      .ilike('product_name', `%${safe}%`)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('created_at', { ascending: false })
      .limit(60);
    pushRows(byName);

    if (collected.size < 8 && name.includes(' ')) {
      const token = name.split(/\s+/).find((w) => w.length >= 4);
      if (token) {
        const { data: byToken } = await supabase
          .from('price_points')
          .select('id, store_name, product_name, price, lat, lng, created_at, category, source, product_id')
          .ilike('product_name', `%${sanitizeIlike(token)}%`)
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .order('created_at', { ascending: false })
          .limit(40);
        pushRows(byToken);
      }
    }
  }

  const all = [...collected.values()];
  if (name.length >= 2) {
    return all.filter((o) => listItemMatchesOfferName(name, o.product_name));
  }
  return all;
}

/**
 * @param {Array<{ store_name: string, product_name: string, price: number, lat: number, lng: number, id?: string }>} offers
 * @param {number | null | undefined} userLat
 * @param {number | null | undefined} userLng
 */
export function pickBarcodeMapPriceHint(offers, userLat, userLng) {
  if (!offers?.length) {
    return {
      hasMapData: false,
      locationUsed: false,
      userAtSaleLocation: false,
      displayOffer: null,
      atStoreOffer: null,
      nearestOffer: null,
      cheapestGlobal: null,
      mapOffers: [],
    };
  }

  const cheapestGlobal = [...offers].sort((a, b) => a.price - b.price)[0];

  const lat = Number(userLat);
  const lng = Number(userLng);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);

  if (!hasLocation) {
    const o = cheapestGlobal;
    return {
      hasMapData: true,
      locationUsed: false,
      userAtSaleLocation: false,
      displayOffer: toOfferHint(o, null),
      atStoreOffer: null,
      nearestOffer: toOfferHint(o, null),
      cheapestGlobal: toOfferHint(cheapestGlobal, null),
      mapOffers: offers.slice(0, 6).map((x) => toOfferHint(x, null)),
    };
  }

  const withDist = offers.map((o) => ({
    ...o,
    distance_m: Math.round(haversineMeters(lat, lng, o.lat, o.lng)),
  }));

  withDist.sort((a, b) => a.distance_m - b.distance_m);

  const atStoreCandidates = withDist.filter((o) => o.distance_m <= BARCODE_AT_STORE_RADIUS_M);
  const atStoreOffer = atStoreCandidates[0] || null;
  const nearestOffer = withDist[0] || null;
  const userAtSaleLocation = Boolean(atStoreOffer);

  const displayOffer = userAtSaleLocation
    ? atStoreOffer
    : nearestOffer;

  return {
    hasMapData: true,
    locationUsed: true,
    userAtSaleLocation,
    displayOffer: toOfferHint(displayOffer, displayOffer?.distance_m ?? null),
    atStoreOffer: atStoreOffer ? toOfferHint(atStoreOffer, atStoreOffer.distance_m) : null,
    nearestOffer: nearestOffer ? toOfferHint(nearestOffer, nearestOffer.distance_m) : null,
    cheapestGlobal: toOfferHint(cheapestGlobal, null),
    mapOffers: withDist.slice(0, 6).map((o) => toOfferHint(o, o.distance_m)),
  };
}

function toOfferHint(row, distanceM) {
  if (!row) return null;
  return {
    price: row.price,
    store_name: row.store_name || '',
    product_name: row.product_name || '',
    distance_m: distanceM,
    lat: row.lat,
    lng: row.lng,
    offer_id: row.id ? `pp:${row.id}` : null,
  };
}

/**
 * Compatível com priceHints legado + campos novos.
 */
export function buildBarcodePriceHints(openFoodFacts, yourPurchases, mapPick) {
  let referencePrice = null;
  let referenceStore = null;
  if (yourPurchases?.length) {
    const p0 = yourPurchases[0];
    const n = typeof p0?.price === 'number' ? p0.price : parseFloat(p0?.price);
    referencePrice = Number.isFinite(n) ? n : null;
    referenceStore = p0?.estabelecimento || null;
  }

  const display = mapPick?.displayOffer;
  const bestPrice = display?.price != null ? Number(display.price) : null;
  const bestStoreName = display?.store_name || null;
  const bestProductName = display?.product_name || null;

  let economyVsBest = null;
  if (referencePrice != null && bestPrice != null && bestPrice > 0) {
    economyVsBest = referencePrice - bestPrice;
  }

  return {
    referencePrice,
    referenceStore,
    bestPrice: bestPrice != null && Number.isFinite(bestPrice) ? bestPrice : null,
    bestStoreName,
    bestProductName,
    economyVsBest,
    hasMapData: Boolean(mapPick?.hasMapData),
    locationUsed: Boolean(mapPick?.locationUsed),
    userAtSaleLocation: Boolean(mapPick?.userAtSaleLocation),
    distanceM: display?.distance_m ?? null,
    atStoreOffer: mapPick?.atStoreOffer || null,
    nearestOffer: mapPick?.nearestOffer || null,
    cheapestGlobal: mapPick?.cheapestGlobal || null,
    mapOffers: mapPick?.mapOffers || [],
  };
}

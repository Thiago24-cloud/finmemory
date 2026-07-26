import { compareListWithMapOffers } from '../shoppingListMapCompare';
import { fetchMapOffersForInsumos } from '../merchant/compras/fetchMapOffersForInsumos';
import { haversineKm } from '../merchant/compras/chainCompare';
import { getDemoPurchaseStoresForInsumo } from './bridgeDemoCatalog';

const DEFAULT_RADIUS_KM = 25;
const RADIUS_EXPAND_STEPS = [25, 50, 100, 200];
/** Ofertas a mais de 120 km só entram se não houver nada mais perto. */
const OUTLIER_DISTANCE_KM = 120;

function withDistance(stores, lat, lng) {
  return stores.map((s) => ({
    ...s,
    distance_km:
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      s.lat != null &&
      s.lng != null &&
      Number.isFinite(Number(s.lat)) &&
      Number.isFinite(Number(s.lng))
        ? haversineKm(lat, lng, Number(s.lat), Number(s.lng))
        : null,
  }));
}

function sortStores(stores) {
  return [...stores].sort((a, b) => {
    const aDist = a.distance_km;
    const bDist = b.distance_km;
    if (aDist == null && bDist == null) return a.preco - b.preco;
    if (aDist == null) return 1;
    if (bDist == null) return -1;
    if (Math.abs(aDist - bDist) > 0.3) return aDist - bDist;
    return a.preco - b.preco;
  });
}

function filterWithinRadius(stores, radiusKm) {
  const withCoords = stores.filter((s) => s.distance_km != null);
  if (!withCoords.length) return stores;
  const nearby = withCoords.filter((s) => s.distance_km <= radiusKm);
  return nearby.length ? nearby : stores;
}

function dropOutlierDistances(stores) {
  const sane = stores.filter((s) => s.distance_km == null || s.distance_km <= OUTLIER_DISTANCE_KM);
  return sane.length ? sane : stores;
}

function applyRegionalFilter(stores, lat, lng, preferredRadiusKm) {
  const distanced = withDistance(stores, lat, lng);
  const steps = [
    preferredRadiusKm,
    ...RADIUS_EXPAND_STEPS.filter((r) => r !== preferredRadiusKm),
  ].filter((r) => Number.isFinite(r) && r > 0);

  let picked = distanced;
  let radiusUsed = steps[0] || DEFAULT_RADIUS_KM;
  let expanded = false;

  for (const radius of steps) {
    const candidate = filterWithinRadius(distanced, radius);
    const hasNearby = candidate.some((s) => s.distance_km != null && s.distance_km <= radius);
    if (hasNearby) {
      picked = candidate;
      radiusUsed = radius;
      expanded = radius !== (preferredRadiusKm || DEFAULT_RADIUS_KM);
      break;
    }
  }

  picked = dropOutlierDistances(picked);
  return {
    stores: sortStores(picked),
    radius_km: radiusUsed,
    expanded,
  };
}

/**
 * Busca lojas onde comprar um insumo (preços reais do mapa + fallback demo).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ nome: string, ean?: string|null, custo_medio?: number|null, lat?: number|null, lng?: number|null, radius_km?: number|null }} opts
 */
export async function findPurchaseLocationsForInsumo(supabase, opts) {
  const nome = String(opts.nome || '').trim();
  if (nome.length < 2) {
    return {
      product: nome,
      stores: [],
      is_demo: false,
      precos_reais: false,
      best: null,
      radius_km: null,
    };
  }

  const lat = Number(opts.lat);
  const lng = Number(opts.lng);
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);
  const preferredRadius = Number(opts.radius_km) > 0 ? Number(opts.radius_km) : DEFAULT_RADIUS_KM;

  const insumo = { id: 'bridge-q', nome, ean: opts.ean || null };
  const mapRows = await fetchMapOffersForInsumos(supabase, [insumo]);
  const compared = compareListWithMapOffers([nome], mapRows);
  const item = compared.items?.[0];

  let stores = (item?.offers || []).map((o) => ({
    nome_loja: o.nome_loja,
    produto_nome: o.produto_nome,
    preco: o.preco,
    lat: o.lat ?? null,
    lng: o.lng ?? null,
    origem: o.origem || 'mapa',
    preco_real: true,
  }));

  let is_demo = false;
  let precos_reais = stores.length > 0;
  let radius_km = null;
  let region_expanded = false;
  let total_mapa = stores.length;

  if (stores.length === 0 && hasCenter) {
    stores = getDemoPurchaseStoresForInsumo({ nome, custo_medio: opts.custo_medio }, lat, lng).map(
      (s) => ({ ...s, preco_real: false })
    );
    is_demo = true;
    precos_reais = false;
    radius_km = preferredRadius;
  } else if (hasCenter) {
    const regional = applyRegionalFilter(stores, lat, lng, preferredRadius);
    stores = regional.stores;
    radius_km = regional.radius_km;
    region_expanded = regional.expanded;
  } else {
    stores = sortStores(stores);
  }

  const best = stores[0] || null;

  return {
    product: nome,
    stores: stores.slice(0, 8),
    is_demo,
    precos_reais,
    radius_km,
    region_expanded,
    total_mapa,
    best,
    matched_offers: item?.offersCount || 0,
  };
}

import { createClient } from '@supabase/supabase-js';
import { formatAgentPromoMapCategory } from '../../../lib/mapPromoCategory';
import { bboxIsStateOrMacroRegion } from '../../../lib/saoPauloStateMap';

/**
 * GET /api/map/stores
 * Modo 1 (próximos): ?lat=-23.55&lng=-46.63&radius=2000 → lojas próximas (sugestão / geo-fencing).
 * Modo 2 (mapa): ?sw_lat=&sw_lng=&ne_lat=&ne_lng= → lojas na área visível do mapa (bbox).
 */
let supabaseInstance = null;

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

/** Não listar farmácias/drogarias como pins de estabelecimento no mapa de preços. */
function isPharmacyStoreType(type) {
  const t = String(type || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!t) return false;
  return (
    t === 'pharmacy' ||
    t === 'farmacia' ||
    t === 'drugstore' ||
    t.includes('farmacia') ||
    t.includes('drogaria')
  );
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  const swLat = parseFloat(req.query.sw_lat);
  const swLng = parseFloat(req.query.sw_lng);
  const neLat = parseFloat(req.query.ne_lat);
  const neLng = parseFloat(req.query.ne_lng);
  const useBbox = !Number.isNaN(swLat) && !Number.isNaN(swLng) && !Number.isNaN(neLat) && !Number.isNaN(neLng);

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radiusM = Math.min(Number(req.query.radius) || 2000, 5000);

  let latMin, latMax, lngMin, lngMax;

  if (useBbox) {
    latMin = Math.min(swLat, neLat);
    latMax = Math.max(swLat, neLat);
    lngMin = Math.min(swLng, neLng);
    lngMax = Math.max(swLng, neLng);
  } else {
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'Use lat/lng/radius ou sw_lat/sw_lng/ne_lat/ne_lng (bbox)' });
    }
    const delta = (radiusM / 1000) / 111;
    latMin = lat - delta;
    latMax = lat + delta;
    lngMin = lng - delta;
    lngMax = lng + delta;
  }

  try {
    // Não incluir cnpj no SELECT até a migração existir em produção (evita 42703 column does not exist).
    const { data, error } = await supabase
      .from('stores')
      .select('id, name, type, address, lat, lng, neighborhood')
      .eq('active', true)
      .gte('lat', latMin)
      .lte('lat', latMax)
      .gte('lng', lngMin)
      .lte('lng', lngMax)
      .limit(
        useBbox
          ? bboxIsStateOrMacroRegion({
              minLat: latMin,
              maxLat: latMax,
              minLng: lngMin,
              maxLng: lngMax,
            })
            ? Math.min(
                2500,
                Math.max(800, Number.parseInt(process.env.MAP_STORES_BBOX_LIMIT_LARGE || '1800', 10) || 1800)
              )
            : Math.min(
                1200,
                Math.max(400, Number.parseInt(process.env.MAP_STORES_BBOX_LIMIT || '600', 10) || 600)
              )
          : 100
      );

    if (error) {
      console.error('Erro ao buscar stores:', error);
      return res.status(500).json({ error: error.message });
    }

    const storesRows = (data || []).filter((s) => !isPharmacyStoreType(s.type));

    const ttlHours = 24;
    const cutoffIso = new Date(Date.now() - ttlHours * 60 * 60 * 1000).toISOString();
    const promoThresholdKm = 0.6; // distância máxima para considerar que o ponto pertence à loja

    const isPromoCategory = (cat) => {
      const s = cat == null ? '' : String(cat).toLowerCase();
      return s.includes('promo');
    };

    // Busca pontos promocionais recentes na mesma área para saber quais lojas ficam "laranja"
    // (MVP: não depende de nova coluna no schema; usa created_at + categoria).
    const { data: promoPoints, error: promoErr } = await supabase
      .from('price_points')
      .select('lat,lng,category,store_name,product_name,created_at')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .gte('created_at', cutoffIso)
      .gte('lat', latMin)
      .lte('lat', latMax)
      .gte('lng', lngMin)
      .lte('lng', lngMax)
      .limit(2000);

    if (promoErr) {
      console.warn('Aviso: erro ao buscar promo points para tem_oferta_hoje:', promoErr.message);
    }

    // Promoções do agente (promocoes_supermercados) — mesmo critério de proximidade que price_points
    let promoAgentRows = [];
    try {
      const { data: agentPromos, error: agentPromoErr } = await supabase
        .from('promocoes_supermercados')
        .select('lat,lng,supermercado,nome_produto,expira_em,categoria')
        .eq('ativo', true)
        .gt('expira_em', new Date().toISOString())
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .gte('lat', latMin)
        .lte('lat', latMax)
        .gte('lng', lngMin)
        .lte('lng', lngMax)
        .limit(2000);
      if (agentPromoErr) {
        console.warn('Aviso: promocoes_supermercados indisponível:', agentPromoErr.message);
      } else {
        promoAgentRows = (agentPromos || []).map((r) => ({
          lat: r.lat,
          lng: r.lng,
          category: formatAgentPromoMapCategory(r.categoria),
          store_name: String(r.supermercado || ''),
          product_name: r.nome_produto,
          created_at: new Date().toISOString(),
        }));
      }
    } catch (e) {
      console.warn('Aviso: promocoes_supermercados:', e.message);
    }

    const storesBase = storesRows;
    const storeOfferMap = new Map(storesBase.map((s) => [s.id, false]));
    const storeOfferCountMap = new Map(storesBase.map((s) => [s.id, 0]));
    const storeOfferProductsMap = new Map(storesBase.map((s) => [s.id, []]));

    const attachOffer = (storeId, productName) => {
      storeOfferMap.set(storeId, true);
      storeOfferCountMap.set(storeId, (storeOfferCountMap.get(storeId) || 0) + 1);
      const current = storeOfferProductsMap.get(storeId) || [];
      const prod = String(productName || '').trim();
      if (prod && !current.includes(prod) && current.length < 6) {
        current.push(prod);
        storeOfferProductsMap.set(storeId, current);
      }
    };

    // Ativa tem_oferta_hoje se existir pelo menos 1 ponto promocional recente próximo da loja.
    const points = [
      ...(promoPoints || []).filter(
        (p) => p && p.lat != null && p.lng != null && isPromoCategory(p.category)
      ),
      ...promoAgentRows,
    ];
    for (const p of points) {
      const pLat = Number(p.lat);
      const pLng = Number(p.lng);
      if (Number.isNaN(pLat) || Number.isNaN(pLng)) continue;

      // 1) Tentativa rápida por nome (se bater, evita cálculo de distância)
      const pStoreName = (p.store_name || '').toLowerCase();
      let matched = false;
      if (pStoreName) {
        for (const s of storesBase) {
          if (String(s.name || '').toLowerCase() === pStoreName) {
            attachOffer(s.id, p.product_name);
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;

      // 2) Caso não bata o nome, usa distância entre lat/lng
      for (const s of storesBase) {
        const sLat = Number(s.lat);
        const sLng = Number(s.lng);
        if (Number.isNaN(sLat) || Number.isNaN(sLng)) continue;
        const d = distanceKm(sLat, sLng, pLat, pLng);
        if (d <= promoThresholdKm) {
          attachOffer(s.id, p.product_name);
          break;
        }
      }
    }

    if (useBbox) {
      const stores = storesRows.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        neighborhood: s.neighborhood,
        tem_oferta_hoje: !!storeOfferMap.get(s.id),
        offer_count: storeOfferCountMap.get(s.id) || 0,
        offer_products: storeOfferProductsMap.get(s.id) || []
      }));
      return res.status(200).json({ stores });
    }

    const radiusKm = radiusM / 1000;
    const withDistance = storesRows
      .map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        neighborhood: s.neighborhood,
        tem_oferta_hoje: !!storeOfferMap.get(s.id),
        offer_count: storeOfferCountMap.get(s.id) || 0,
        offer_products: storeOfferProductsMap.get(s.id) || [],
        distance_km: distanceKm(lat, lng, s.lat, s.lng)
      }))
      .filter((s) => s.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 30)
      .map(({ distance_km, ...rest }) => ({ ...rest, distance_km: Math.round(distance_km * 100) / 100 }));

    return res.status(200).json({ stores: withDistance });
  } catch (e) {
    console.error('Erro em /api/map/stores:', e);
    return res.status(500).json({ error: e.message });
  }
}

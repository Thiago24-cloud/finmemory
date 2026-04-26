import { createClient } from '@supabase/supabase-js';
import { bboxIsStateOrMacroRegion } from '../../../lib/saoPauloStateMap';
import { getPublicProductImageUrl } from '../../../lib/productImageUrl';
import { enrichMapPointsImageUrls } from '../../../lib/enrichMapPointImages';
import { hydratePointsFromImageCache } from '../../../lib/mapProductImageCache';
import {
  applyNormKeyImageLookup,
  applyPeerPromoImageReuse,
  buildImageUrlByNormKeyFromPairs,
} from '../../../lib/reuseMapProductImages';
import { isExcludedFromPriceMapPoint } from '../../../lib/mapExcludedMapStores';
import { parsePriceToNumber } from '../../../lib/parseMapPrice';
import { displayPromoProductName, productNameForThumbnailSearch } from '../../../lib/mapOfferDisplay';
import { isPomarDaVilaCuratedStoreName, isSacolaoSaoJorgeCuratedStoreName } from '../../../lib/storeLogos';
import { pickStoreLogoFromCacheRows } from '../../../lib/mapStoreLogoCache';
import {
  inferChainSlugFromPromoStoreName,
  isLikelyNonProductScraperTitle,
  normalizeMapChainText,
  promoStoreNamesLooselyAlign,
  storeNormalizedMatchesChainSlug,
} from '../../../lib/mapStoreChainMatch';
import { isPromotionEligibleForMapPin, todayIsoSaoPaulo } from '../../../lib/promotionValidity';
import { normalizeStoreNameMatchKey } from '../../../lib/mapStoreNameNormalize';
import {
  fetchActiveMapPinSuppressions,
  isStoreRowSuppressedByPinRules,
} from '../../../lib/mapPinLocationSuppressions';
import { fetchCuratedPinOptOutStoreIds } from '../../../lib/mapCuratedPinOptOut';
import { httpsPromoImageUrlForMapJson } from '../../../lib/httpsPromoImageUrlForMap';

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

/**
 * Supermercados e padarias só entram no JSON do mapa se tiverem oferta/promo ativa no app
 * (price_points promocionais recentes ou promocoes_supermercados). Outros tipos (ex.: restaurante) seguem visíveis.
 */
function isSupermarketOrBakeryMapType(type) {
  const t = String(type || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!t) return false;
  if (t === 'bakery' || t === 'padaria') return true;
  if (t === 'supermarket' || t === 'supermercado') return true;
  if (t.includes('supermercado') || t.includes('hipermercado')) return true;
  if (t.includes('padaria') || t.includes('panificadora')) return true;
  return false;
}

/**
 * Itens em `offer_preview` por loja no GET /api/map/stores (popup do pin + pílula).
 * O contador `offer_count` pode ser maior; lista completa em GET /api/map/store-offers.
 */
function getStoreOfferPreviewLimit() {
  const raw = Number.parseInt(process.env.MAP_STORE_OFFER_PREVIEW_LIMIT || '80', 10);
  if (!Number.isFinite(raw)) return 80;
  return Math.min(250, Math.max(16, raw));
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
    // Mantém a janela de ofertas alinhada com /api/map/points:
    // promoções podem viver mais tempo que preços comuns.
    const defaultTtlHours = Math.max(
      1,
      Number.parseInt(process.env.MAP_DEFAULT_TTL_HOURS || '24', 10) || 24
    );
    const promoTtlHours = Math.max(
      defaultTtlHours,
      Number.parseInt(process.env.MAP_PROMO_TTL_HOURS || '168', 10) || 168
    );
    const normalCutoffIso = new Date(Date.now() - defaultTtlHours * 60 * 60 * 1000).toISOString();
    const promoCutoffIso = new Date(Date.now() - promoTtlHours * 60 * 60 * 1000).toISOString();
    const promoThresholdKm = Number(process.env.MAP_STORE_OFFERS_RADIUS_KM) || 1.25;
    const chainSlugRadiusKm =
      Number.parseFloat(process.env.MAP_STORE_OFFERS_CHAIN_SLUG_RADIUS_KM || '') || 2.5;

    const isPromoCategory = (cat) => {
      const s = cat == null ? '' : String(cat).toLowerCase();
      return s.includes('promo');
    };

    const storeLimit = useBbox
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
      : 100;

    const storesQuery = supabase
      .from('stores')
      .select('id, name, type, address, lat, lng, neighborhood, photo_url')
      .eq('active', true)
      .gte('lat', latMin)
      .lte('lat', latMax)
      .gte('lng', lngMin)
      .lte('lng', lngMax)
      .limit(storeLimit);

    // Sem image_url: em projetos sem migração da coluna o SELECT falha e o endpoint inteiro quebra.
    const promoPointsPromoQuery = supabase
      .from('price_points')
      .select(
        'id, lat, lng, category, store_name, product_name, created_at, price, product_id'
      )
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .in('source', ['bot_fila_aprovado', 'admin_manual', 'community_manual'])
      .ilike('category', '%promo%')
      .gte('created_at', promoCutoffIso)
      .gte('lat', latMin)
      .lte('lat', latMax)
      .gte('lng', lngMin)
      .lte('lng', lngMax)
      .limit(2000);

    const promoPointsNormalQuery = supabase
      .from('price_points')
      .select(
        'id, lat, lng, category, store_name, product_name, created_at, price, product_id'
      )
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .in('source', ['bot_fila_aprovado', 'admin_manual', 'community_manual'])
      .not('category', 'ilike', '%promo%')
      .gte('created_at', normalCutoffIso)
      .gte('lat', latMin)
      .lte('lat', latMax)
      .gte('lng', lngMin)
      .lte('lng', lngMax)
      .limit(2000);

    const [
      { data, error },
      { data: promoPointsPromo, error: promoPromoErr },
      { data: promoPointsNormal, error: promoNormalErr },
    ] = await Promise.all([storesQuery, promoPointsPromoQuery, promoPointsNormalQuery]);

    if (error) {
      console.error('Erro ao buscar stores:', error);
      return res.status(500).json({ error: error.message });
    }

    if (promoPromoErr) {
      console.warn('Aviso: erro ao buscar promo points (promo):', promoPromoErr.message);
    }
    if (promoNormalErr) {
      console.warn('Aviso: erro ao buscar promo points (normal):', promoNormalErr.message);
    }
    const promoPoints = [...(promoPointsPromo || []), ...(promoPointsNormal || [])];
    let pinSuppressions = [];
    try {
      pinSuppressions = await fetchActiveMapPinSuppressions(supabase);
    } catch (e) {
      console.warn('stores pin suppressions:', e?.message || e);
    }

    let curatedPinOptOutIds = new Set();
    try {
      curatedPinOptOutIds = await fetchCuratedPinOptOutStoreIds(supabase);
    } catch (e) {
      console.warn('stores curated pin opt-out:', e?.message || e);
    }

    const storesRows = (data || [])
      .filter((s) => !isPharmacyStoreType(s.type))
      .filter((s) => !isExcludedFromPriceMapPoint({ store_name: s.name, lat: s.lat, lng: s.lng }))
      .filter((s) => !isStoreRowSuppressedByPinRules(s, pinSuppressions));

    const storesBase = storesRows;
    const storeById = new Map(storesBase.map((s) => [s.id, s]));
    const storeOfferMap = new Map(storesBase.map((s) => [s.id, false]));
    const storeOfferCountMap = new Map(storesBase.map((s) => [s.id, 0]));
    /** @type {Map<string, Map<string, object>>} */
    const storeOfferPreviewMap = new Map();

    const attachOffer = (store, p) => {
      const storeId = store.id;
      storeOfferMap.set(storeId, true);
      storeOfferCountMap.set(storeId, (storeOfferCountMap.get(storeId) || 0) + 1);
      const key =
        (p.id != null && String(p.id).trim() !== '' && String(p.id)) ||
        `synthetic:${String(p.product_name || '').slice(0, 60)}|${Number(p.lat).toFixed(4)}|${Number(p.lng).toFixed(4)}`;
      const bucket = storeOfferPreviewMap.get(storeId) || new Map();
      if (!bucket.has(key)) {
        bucket.set(key, {
          id: p.id ?? key,
          product_name: p.product_name,
          price: p.price,
          category: p.category,
          created_at: p.created_at,
          image_url: null,
          imagem_url: p.imagem_url ?? null,
          product_id: p.product_id ?? null,
          display_store_name: store.name,
        });
      }
      storeOfferPreviewMap.set(storeId, bucket);
    };

    /** Nome normalizado (sem acento) → loja (primeira ocorrência) — evita loop O(S) por ponto. */
    const storeByExactName = new Map();
    for (const s of storesBase) {
      const n = normalizeStoreNameMatchKey(s.name);
      if (n && !storeByExactName.has(n)) storeByExactName.set(n, s);
    }

    /** Grade espacial ~0,5 km: só compara distância com lojas na célula vizinha (evita O(P×S)). */
    const CELL_LAT = 0.005;
    const CELL_LNG = 0.005;
    const storeBuckets = new Map();
    for (const s of storesBase) {
      const sLat = Number(s.lat);
      const sLng = Number(s.lng);
      if (Number.isNaN(sLat) || Number.isNaN(sLng)) continue;
      const key = `${Math.floor(sLat / CELL_LAT)}:${Math.floor(sLng / CELL_LNG)}`;
      if (!storeBuckets.has(key)) storeBuckets.set(key, []);
      storeBuckets.get(key).push(s);
    }

    /** Ofertas em `public.promotions` para o pin: período do encarte (ver isPromotionEligibleForMapPin); o painel usa isPromotionActiveOnDate. */
    let promoFromTableRows = [];
    const storeIdsForPromotions = storesBase.map((s) => s.id).filter(Boolean);
    if (storeIdsForPromotions.length) {
      const todaySp = todayIsoSaoPaulo();
      const chunkSize = 120;
      for (let i = 0; i < storeIdsForPromotions.length; i += chunkSize) {
        const chunk = storeIdsForPromotions.slice(i, i + chunkSize);
        const { data: prs, error: prErr } = await supabase
          .from('promotions')
          .select(
            'id, product_name, promo_price, category, valid_from, valid_until, valid_dates, created_at, store_id, product_image_url, flyer_image_url'
          )
          .eq('active', true)
          .eq('is_individual_product', true)
          .in('store_id', chunk)
          .limit(600);
        if (prErr) {
          console.warn('stores promotions:', prErr.message);
          continue;
        }
        for (const r of prs || []) {
          if (!isPromotionEligibleForMapPin(r, todaySp)) continue;
          const st = storeById.get(r.store_id);
          if (!st) continue;
          const sLat = Number(st.lat);
          const sLng = Number(st.lng);
          if (Number.isNaN(sLat) || Number.isNaN(sLng)) continue;
          if (isLikelyNonProductScraperTitle(r.product_name)) continue;
          const slug = inferChainSlugFromPromoStoreName(st.name);
          promoFromTableRows.push({
            id: `ptbl-${r.id}`,
            lat: sLat,
            lng: sLng,
            category: formatAgentPromoMapCategory(r.category),
            store_name: String(st.name || ''),
            agent_supermercado_slug: slug,
            product_name: r.product_name,
            created_at: r.created_at || new Date().toISOString(),
            price: r.promo_price != null ? Number(r.promo_price) : null,
            product_id: null,
            imagem_url: r.product_image_url || r.flyer_image_url || null,
            image_url: null,
          });
        }
      }
    }

    // Ativa tem_oferta_hoje: promoções OU price_points com nome de loja igual ao cadastro (Quick Add / curadoria).
    const points = [
      ...(promoPoints || []).filter((p) => {
        if (!p || p.lat == null || p.lng == null) return false;
        if (isExcludedFromPriceMapPoint(p)) return false;
        const sn = normalizeStoreNameMatchKey(p.store_name);
        if (sn && storeByExactName.has(sn)) return true;
        return isPromoCategory(p.category);
      }),
      ...promoFromTableRows.filter((p) => !isExcludedFromPriceMapPoint(p)),
    ];
    for (const p of points) {
      if (isLikelyNonProductScraperTitle(p.product_name)) continue;
      const pLat = Number(p.lat);
      const pLng = Number(p.lng);
      if (Number.isNaN(pLat) || Number.isNaN(pLng)) continue;

      const pStoreName = normalizeStoreNameMatchKey(p.store_name);
      if (pStoreName) {
        const byName = storeByExactName.get(pStoreName);
        if (byName) {
          attachOffer(byName, p);
          continue;
        }
      }

      const fx = Math.floor(pLat / CELL_LAT);
      const fy = Math.floor(pLng / CELL_LNG);
      const chainSlug =
        p.agent_supermercado_slug ||
        inferChainSlugFromPromoStoreName(p.store_name) ||
        null;
      /* 5×5: vários candidatos no raio — escolhe o mais próximo cuja rede bate com a oferta */
      let bestStore = null;
      let bestD = Infinity;
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const list = storeBuckets.get(`${fx + dx}:${fy + dy}`);
          if (!list) continue;
          for (const s of list) {
            const sLat = Number(s.lat);
            const sLng = Number(s.lng);
            if (Number.isNaN(sLat) || Number.isNaN(sLng)) continue;
            const d = distanceKm(sLat, sLng, pLat, pLng);
            const sNorm = normalizeMapChainText(s.name);
            const chainMatch =
              chainSlug && storeNormalizedMatchesChainSlug(sNorm, chainSlug);
            const maxDistKm = chainMatch
              ? Math.max(promoThresholdKm, chainSlugRadiusKm)
              : promoThresholdKm;
            if (d > maxDistKm) continue;
            if (chainSlug) {
              if (!storeNormalizedMatchesChainSlug(sNorm, chainSlug)) continue;
            } else if (!promoStoreNamesLooselyAlign(s.name, p.store_name)) {
              continue;
            }
            if (d < bestD) {
              bestD = d;
              bestStore = s;
            }
          }
        }
      }
      if (bestStore) attachOffer(bestStore, p);
    }

    const storesVisible = storesRows.filter((s) => {
      if (!isSupermarketOrBakeryMapType(s.type)) return true;
      if (curatedPinOptOutIds.has(String(s.id))) {
        return !!storeOfferMap.get(s.id);
      }
      if (isPomarDaVilaCuratedStoreName(s.name)) return true;
      if (isSacolaoSaoJorgeCuratedStoreName(s.name)) return true;
      return !!storeOfferMap.get(s.id);
    });

    const offerPreviewCap = getStoreOfferPreviewLimit();
    /** Pré-visualização no pin (cap configurável); painel completo via GET /api/map/store-offers. */
    const finalizeOfferPreview = (storeId) => {
      const bucket = storeOfferPreviewMap.get(storeId);
      if (!bucket || bucket.size === 0) return [];
      return [...bucket.values()]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, offerPreviewCap);
    };

    let pathByProductId = new Map();
    try {
      const allPreview = [];
      for (const s of storesVisible) {
        for (const row of finalizeOfferPreview(s.id)) allPreview.push(row);
      }
      const productIds = [
        ...new Set([
          ...allPreview.map((r) => r.product_id).filter(Boolean),
          ...(promoPoints || []).map((p) => p.product_id).filter(Boolean),
        ]),
      ];
      if (productIds.length > 0) {
        const { data: imgRows, error: imgErr } = await supabase
          .from('product_images')
          .select('product_id, storage_path')
          .in('product_id', productIds)
          .eq('is_primary', true);
        if (!imgErr && imgRows?.length) {
          for (const ir of imgRows) {
            if (ir.product_id && ir.storage_path && !pathByProductId.has(ir.product_id)) {
              pathByProductId.set(ir.product_id, ir.storage_path);
            }
          }
        }
      }
      const reusePairs = [];
      for (const row of promoPoints || []) {
        let url = row.image_url || null;
        const pid = row.product_id;
        if (pid && pathByProductId.has(pid)) {
          const fromCat = getPublicProductImageUrl(pathByProductId.get(pid));
          if (fromCat) url = fromCat;
        }
        reusePairs.push({ product_name: row.product_name, url });
      }
      const urlByNormKey = buildImageUrlByNormKeyFromPairs(reusePairs);

      for (const row of allPreview) {
        let promoUrl = row.imagem_url || row.image_url || null;
        const pid = row.product_id;
        if (pid && pathByProductId.has(pid)) {
          const fromCatalog = getPublicProductImageUrl(pathByProductId.get(pid));
          if (fromCatalog) promoUrl = fromCatalog;
        }
        row.promo_image_url = promoUrl;
      }
      applyPeerPromoImageReuse(allPreview);
      applyNormKeyImageLookup(allPreview, urlByNormKey);
      try {
        await hydratePointsFromImageCache(supabase, allPreview);
      } catch (e) {
        console.warn('stores hydratePointsFromImageCache:', e.message);
      }
      if (process.env.MAP_STORES_OFF_ENRICH !== '0' && allPreview.length > 0) {
        const useCse =
          process.env.MAP_POINTS_GOOGLE_CSE_FALLBACK === '1' &&
          Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID);
        const cap = Number.parseInt(process.env.MAP_STORES_MAX_OFF_NAMES || '150', 10) || 150;
        await enrichMapPointsImageUrls(allPreview, {
          maxUniqueNames: Math.min(200, Math.max(allPreview.length, cap)),
          concurrency: 4,
          useGoogleCse: useCse,
          nameForSearch: (p) => productNameForThumbnailSearch(p.product_name),
        });
      }
    } catch (e) {
      console.warn('stores offer_preview imagens:', e.message);
    }

    /** Logos gravados no Quick Add (map_store_logo_cache) — match por nome normalizado. */
    let storeLogoCacheRows = [];
    try {
      let { data: slData, error: slErr } = await supabase
        .from('map_store_logo_cache')
        .select('norm_key, image_url, updated_at')
        .limit(500);
      if (slErr && /updated_at|column/i.test(slErr.message || '')) {
        const r2 = await supabase.from('map_store_logo_cache').select('norm_key, image_url').limit(500);
        slData = r2.data;
        slErr = r2.error;
      }
      if (!slErr && Array.isArray(slData)) storeLogoCacheRows = slData;
    } catch (e) {
      console.warn('stores map_store_logo_cache:', e?.message || e);
    }

    const buildStorePayload = (s) => {
      const preview = finalizeOfferPreview(s.id);
      const headlineRow = preview.find((o) => parsePriceToNumber(o.price) != null);
      let pinHeadlinePrice = null;
      if (headlineRow) {
        pinHeadlinePrice = parsePriceToNumber(headlineRow.price);
      }
      const offer_products = preview.map((o) => {
        const clean = displayPromoProductName(o.product_name, s.name);
        const n = parsePriceToNumber(o.price);
        if (n != null) {
          const brl = n.toFixed(2).replace('.', ',');
          return `${clean} — R$ ${brl}`;
        }
        return clean;
      });
      const pinLogoFromCache = pickStoreLogoFromCacheRows(s.name, storeLogoCacheRows);
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        neighborhood: s.neighborhood,
        photo_url: httpsPromoImageUrlForMapJson(s.photo_url) || null,
        tem_oferta_hoje: !!storeOfferMap.get(s.id),
        offer_count: storeOfferCountMap.get(s.id) || 0,
        /** Preço mais recente no pin (estilo Google Maps / Airbnb). */
        pin_headline_price: pinHeadlinePrice,
        pin_headline_product: headlineRow?.product_name
          ? String(displayPromoProductName(headlineRow.product_name, s.name)).slice(0, 80)
          : null,
        offer_products,
        offer_preview: preview.map(
          ({
            id,
            product_name,
            price,
            category,
            promo_image_url,
            display_store_name,
            product_id,
          }) => ({
            id,
            product_name: displayPromoProductName(product_name, s.name),
            price,
            category,
            promo_image_url: httpsPromoImageUrlForMapJson(promo_image_url),
            display_store_name,
            product_id: product_id ?? null,
          })
        ),
        pin_logo_url: pinLogoFromCache || null,
      };
    };

    if (useBbox) {
      const stores = storesVisible.map((s) => buildStorePayload(s));
      return res.status(200).json({ stores });
    }

    const radiusKm = radiusM / 1000;
    const withDistance = storesVisible
      .map((s) => ({
        ...buildStorePayload(s),
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

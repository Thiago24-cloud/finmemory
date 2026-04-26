import { createClient } from '@supabase/supabase-js';
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
import {
  displayPromoProductName,
  productNameForThumbnailSearch,
} from '../../../lib/mapOfferDisplay';
import {
  inferChainSlugFromPromoStoreName,
  isLikelyNonProductScraperTitle,
  normalizeMapChainText,
  promoStoreNamesLooselyAlign,
  storeNormalizedMatchesChainSlug,
} from '../../../lib/mapStoreChainMatch';
import {
  isPromotionEligibleForMapPin,
  todayIsoSaoPaulo,
} from '../../../lib/promotionValidity';
import { sanitizeMapPointsPromoImagesHttpsOnly } from '../../../lib/httpsPromoImageUrlForMap';

/**
 * GET /api/map/store-offers?store_id=UUID
 * Ofertas/promoções ligadas à loja (nome ou proximidade), mesmo critério de /api/map/stores.
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

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function sortKeyPromotionValidity(row) {
  const vd = row?.valid_dates;
  if (Array.isArray(vd) && vd.length > 0) {
    return vd.reduce((mx, d) => {
      const s = String(d).slice(0, 10);
      return s > mx ? s : mx;
    }, '0000-00-00');
  }
  const vu = row?.valid_until;
  if (vu != null && vu !== '') return String(vu).slice(0, 10);
  return '9999-12-31';
}

function sortPromotionTableRows(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  const far = '9999-12-31';
  list.sort((a, b) => {
    const va = sortKeyPromotionValidity(a) || far;
    const vb = sortKeyPromotionValidity(b) || far;
    if (va !== vb) return va.localeCompare(vb);
    const pa = Number(a.promo_price);
    const pb = Number(b.promo_price);
    if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb) return pa - pb;
    return String(a.product_name || '').localeCompare(String(b.product_name || ''), 'pt-BR');
  });
  return list;
}

function dedupKeyForStoreOfferRow(row) {
  if (row?.id != null && row.id !== '') {
    return row.source === 'agent_promotions' ? `agent:${String(row.id)}` : `pp:${String(row.id)}`;
  }
  const ts = row.created_at != null ? String(row.created_at) : '';
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const name = normalizeMapChainText(row.product_name || '');
  return `noid:${row.source || 'x'}:${Number.isFinite(lat) ? lat : ''}:${Number.isFinite(lng) ? lng : ''}:${name}:${ts}`;
}

function maskUserId(userId) {
  if (!userId || typeof userId !== 'string') return 'Explorador';
  const last4 = userId.replace(/-/g, '').slice(-4);
  return `Explorador #${last4}`;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `Há ${diffMins} min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays < 7) return `Há ${diffDays} dia(s)`;
  return d.toLocaleDateString('pt-BR');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const storeId = typeof req.query.store_id === 'string' ? req.query.store_id.trim() : '';
  if (!storeId) {
    return res.status(400).json({ error: 'Informe store_id' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  try {
    /** Mesmo núcleo que GET /api/map/stores — evita 404 em projetos sem migrações de colunas opcionais. */
    const storeColsNarrow =
      'id, name, type, lat, lng, address, neighborhood';
    const storeColsWide = `${storeColsNarrow}, phone, website, photo_url, weekday_hours, promo_page_url`;

    let { data: store, error: storeErr } = await supabase
      .from('stores')
      .select(storeColsWide)
      .eq('id', storeId)
      .eq('active', true)
      .maybeSingle();

    if (storeErr) {
      const r2 = await supabase
        .from('stores')
        .select(storeColsNarrow)
        .eq('id', storeId)
        .eq('active', true)
        .maybeSingle();
      store = r2.data;
      storeErr = r2.error;
    }

    if (storeErr || !store) {
      if (storeErr) {
        console.warn('store-offers stores:', storeErr.message);
      }
      return res.status(404).json({ error: 'Loja não encontrada' });
    }
    if (isExcludedFromPriceMapPoint({ store_name: store.name, lat: store.lat, lng: store.lng })) {
      return res.status(404).json({ error: 'Loja não encontrada' });
    }

    const todaySp = todayIsoSaoPaulo();
    let tablePromotions = [];
    try {
      const { data: promData, error: promErr } = await supabase
        .from('promotions')
        .select(
          'id, product_name, promo_price, original_price, unit, category, valid_from, valid_until, valid_dates, validity_note, club_price, flyer_image_url, product_image_url, image_hint, discount_pct, created_at, source, encarte_queue_id'
        )
        .eq('store_id', storeId)
        .eq('active', true)
        .eq('is_individual_product', true)
        .limit(500);
      if (promErr) {
        console.warn('store-offers promotions:', promErr.message);
      } else {
        const raw = promData || [];
        tablePromotions = sortPromotionTableRows(
          raw.filter((r) => isPromotionEligibleForMapPin(r, todaySp))
        );
      }
    } catch (e) {
      console.warn('store-offers promotions:', e.message);
    }

    const sLat = Number(store.lat);
    const sLng = Number(store.lng);
    if (Number.isNaN(sLat) || Number.isNaN(sLng)) {
      return res.status(200).json({
        store,
        offers: [],
        promotions: tablePromotions,
      });
    }

    const delta = 0.05;
    const latMin = sLat - delta;
    const latMax = sLat + delta;
    const lngMin = sLng - delta;
    const lngMax = sLng + delta;
    /** Raio oferta↔pin (km). 1.25 absorve pequeno desvio GPS / cadastro vs fan-out do agente. */
    const promoThresholdKm = Number(process.env.MAP_STORE_OFFERS_RADIUS_KM) || 1.25;
    /** Curadoria/agente podem usar coords de referência ~1–2 km do pin OSM/Google do `stores`. */
    const chainSlugRadiusKm =
      Number.parseFloat(process.env.MAP_STORE_OFFERS_CHAIN_SLUG_RADIUS_KM || '') || 2.5;

    const defaultTtlHours = Math.max(
      1,
      Number.parseInt(process.env.MAP_DEFAULT_TTL_HOURS || '24', 10) || 24
    );
    const promoTtlHours = Math.max(
      defaultTtlHours,
      Number.parseInt(process.env.MAP_PROMO_TTL_HOURS || '168', 10) || 168
    );
    const storePromoTtlHours = Math.max(
      1,
      Number.parseInt(process.env.MAP_STORE_OFFERS_PROMO_TTL_HOURS || '24', 10) || 24
    );
    /** Só para `price_points` (divulgação/import categoria promo). O agente usa `expira_em` (ex.: 72h). */
    const promoCutoffIso = new Date(
      Date.now() - Math.max(storePromoTtlHours, promoTtlHours) * 60 * 60 * 1000
    ).toISOString();
    const normalCutoffIso = new Date(Date.now() - defaultTtlHours * 60 * 60 * 1000).toISOString();

    const baseSelect =
      'id, product_name, price, store_name, lat, lng, category, created_at, atualizado_em, user_id, product_id';

    const promoQ = supabase
      .from('price_points')
      .select(baseSelect)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .in('source', ['bot_fila_aprovado', 'admin_manual', 'community_manual'])
      .ilike('category', '%promo%')
      .gte('created_at', promoCutoffIso)
      .gte('lat', latMin)
      .lte('lat', latMax)
      .gte('lng', lngMin)
      .lte('lng', lngMax)
      .order('created_at', { ascending: false })
      .limit(2000);

    const normalQ = supabase
      .from('price_points')
      .select(baseSelect)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .in('source', ['bot_fila_aprovado', 'admin_manual', 'community_manual'])
      .not('category', 'ilike', '%promo%')
      .gte('created_at', normalCutoffIso)
      .gte('lat', latMin)
      .lte('lat', latMax)
      .gte('lng', lngMin)
      .lte('lng', lngMax)
      .order('created_at', { ascending: false })
      .limit(2000);

    const reuseQ = supabase
      .from('price_points')
      .select('product_name, product_id, created_at')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .in('source', ['bot_fila_aprovado', 'admin_manual', 'community_manual'])
      .gte('created_at', normalCutoffIso)
      .gte('lat', latMin)
      .lte('lat', latMax)
      .gte('lng', lngMin)
      .lte('lng', lngMax)
      .order('created_at', { ascending: false })
      .limit(2000);

    const [
      { data: promoRows, error: promoErr },
      { data: normalRows, error: normalErr },
      { data: reusePts, error: reuseErr },
    ] = await Promise.all([
      promoQ,
      normalQ,
      reuseQ,
    ]);

    if (promoErr) {
      console.error('store-offers price_points:', promoErr);
      return res.status(500).json({ error: promoErr.message });
    }
    if (normalErr) {
      console.error('store-offers price_points normal:', normalErr);
      return res.status(500).json({ error: normalErr.message });
    }
    if (reuseErr) {
      console.warn('store-offers reuse price_points:', reuseErr.message);
    }

    let merged = [...(promoRows || []), ...(normalRows || [])].map((r) => ({ ...r, source: 'price_points' }));

    // Bloqueio global: não incluir `promocoes_supermercados` em offers de loja.

    console.log('[store-offers] total merged:', merged.length);
    console.log('[store-offers] store:', store.name, store.lat, store.lng);

    const storeNameLower = String(store.name || '').toLowerCase();
    const normalizedStoreName = normalizeMapChainText(store.name);
    const isPaoStore = /(pao de acucar|minuto pao de acucar)/.test(normalizedStoreName);

    const belongs = (row) => {
      const pLat = Number(row.lat);
      const pLng = Number(row.lng);
      if (Number.isNaN(pLat) || Number.isNaN(pLng)) return false;
      const pStoreName = (row.store_name || '').toLowerCase();
      const normalizedPointStoreName = normalizeMapChainText(row.store_name);
      if (pStoreName && pStoreName === storeNameLower) return true;

      const categoryText = String(row.category || '').toLowerCase();
      const rowIsPromo = categoryText.includes('promo');
      if (!rowIsPromo) {
        // Alinha com /api/map/stores: itens não-promo só entram quando o nome da loja casa exatamente.
        return false;
      }

      const slug =
        row.agent_supermercado_slug ||
        inferChainSlugFromPromoStoreName(row.store_name) ||
        null;

      const chainSlugMatchesStore =
        Boolean(slug) && storeNormalizedMatchesChainSlug(normalizedStoreName, slug);
      const maxKm = chainSlugMatchesStore
        ? Math.max(promoThresholdKm, chainSlugRadiusKm)
        : promoThresholdKm;

      const distance = distanceKm(sLat, sLng, pLat, pLng);
      if (distance > maxKm) return false;

      if (isPaoStore) {
        if (slug === 'dia') return false;
        if (slug === 'paodeacucar') {
          return storeNormalizedMatchesChainSlug(normalizedStoreName, 'paodeacucar');
        }
        if (slug) return false;
        const sameBrand =
          normalizedPointStoreName.includes('pao de acucar') ||
          normalizedPointStoreName.includes('minuto pao');
        if (sameBrand) {
          return storeNormalizedMatchesChainSlug(normalizedStoreName, 'paodeacucar');
        }
        return promoStoreNamesLooselyAlign(store.name, row.store_name);
      }

      if (slug) {
        return storeNormalizedMatchesChainSlug(normalizedStoreName, slug);
      }

      return promoStoreNamesLooselyAlign(store.name, row.store_name);
    };

    const filtered = merged.filter(belongs);

    console.log('[store-offers] after belongs filter:', filtered.length);

    const byDedupKey = new Map();
    for (const row of filtered) {
      const dedupKey = dedupKeyForStoreOfferRow(row);
      byDedupKey.set(dedupKey, row);
    }
    const deduped = Array.from(byDedupKey.values())
      .filter((row) => !isLikelyNonProductScraperTitle(row.product_name))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let pathByProductId = new Map();
    let urlByNormKey = new Map();
    try {
      const productIds = [
        ...new Set([
          ...deduped.map((r) => r.product_id).filter(Boolean),
          ...(reusePts || []).map((r) => r.product_id).filter(Boolean),
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
      for (const row of deduped) {
        reusePairs.push({
          product_name: row.product_name,
          url: row.imagem_url || row.image_url || null,
        });
      }
      for (const row of reusePts || []) {
        let url = row.image_url || null;
        const pid = row.product_id;
        if (pid && pathByProductId.has(pid)) {
          const fromCat = getPublicProductImageUrl(pathByProductId.get(pid));
          if (fromCat) url = fromCat;
        }
        reusePairs.push({ product_name: row.product_name, url });
      }
      urlByNormKey = buildImageUrlByNormKeyFromPairs(reusePairs);
    } catch (e) {
      console.warn('store-offers catalog images:', e.message);
    }

    const offers = deduped.map((row) => {
      let promoUrl = row.imagem_url || row.image_url || null;
      const pid = row.product_id;
      if (pid && pathByProductId.has(pid)) {
        const fromCatalog = getPublicProductImageUrl(pathByProductId.get(pid));
        if (fromCatalog) promoUrl = fromCatalog;
      }
      const observedIso = row.atualizado_em || row.created_at;
      return {
        id: row.id,
        product_name: displayPromoProductName(row.product_name, row.store_name),
        price: parsePriceToNumber(row.price),
        store_name: row.store_name,
        lat: Number(row.lat),
        lng: Number(row.lng),
        category: row.category,
        time_ago: formatTimeAgo(observedIso),
        observed_at: observedIso,
        user_label: maskUserId(row.user_id),
        promo_image_url: promoUrl,
        source: row.source || 'unknown',
      };
    });

    applyPeerPromoImageReuse(offers);
    applyNormKeyImageLookup(offers, urlByNormKey);

    try {
      await hydratePointsFromImageCache(supabase, offers);
    } catch (e) {
      console.warn('store-offers hydratePointsFromImageCache:', e.message);
    }

    if (process.env.MAP_POINTS_OFF_ENRICH !== '0') {
      const useCse =
        process.env.MAP_POINTS_GOOGLE_CSE_FALLBACK === '1' &&
        Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID);
      try {
        const cap = Number.parseInt(process.env.MAP_STORE_OFFERS_MAX_NAMES || '150', 10) || 150;
        await enrichMapPointsImageUrls(offers, {
          maxUniqueNames: Math.min(200, Math.max(offers.length, cap)),
          concurrency: 4,
          useGoogleCse: useCse,
          nameForSearch: (p) => productNameForThumbnailSearch(p.product_name),
        });
      } catch (e) {
        console.warn('store-offers enrichMapPointsImageUrls:', e.message);
      }
    }

    console.log('[store-offers] final offers count:', offers.length);
    console.log('[store-offers] promotions count:', tablePromotions.length);

    sanitizeMapPointsPromoImagesHttpsOnly(offers);
    return res.status(200).json({
      store,
      offers,
      promotions: tablePromotions,
    });
  } catch (e) {
    console.error('GET /api/map/store-offers:', e);
    return res.status(500).json({ error: e.message || 'Erro ao carregar ofertas' });
  }
}

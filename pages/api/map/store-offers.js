import { createClient } from '@supabase/supabase-js';
import { getPublicProductImageUrl } from '../../../lib/productImageUrl';
import { formatAgentPromoMapCategory } from '../../../lib/mapPromoCategory';
import { enrichMapPointsImageUrls } from '../../../lib/enrichMapPointImages';

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

function agentLabel(slug) {
  const s = String(slug || '').toLowerCase();
  const map = {
    dia: 'Dia',
    atacadao: 'Atacadão',
    assai: 'Assaí',
    carrefour: 'Carrefour',
    paodeacucar: 'Pão de Açúcar',
    hirota: 'Hirota',
    lopes: 'Lopes',
    sonda: 'Sonda',
    saojorge: 'Sacolão São Jorge',
    mambo: 'Mambo',
    agape: 'Ágape',
    armazemdocampo: 'Armazém do Campo',
  };
  return map[s] || String(slug || 'Rede');
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('id, name, type, lat, lng')
      .eq('id', storeId)
      .eq('active', true)
      .maybeSingle();

    if (storeErr || !store) {
      return res.status(404).json({ error: 'Loja não encontrada' });
    }

    let tablePromotions = [];
    try {
      const { data: promData, error: promErr } = await supabase
        .from('promotions')
        .select('id, product_name, promo_price, original_price, unit, category')
        .eq('store_id', storeId)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(300);
      if (promErr) {
        console.warn('store-offers promotions:', promErr.message);
      } else {
        tablePromotions = promData || [];
      }
    } catch (e) {
      console.warn('store-offers promotions:', e.message);
    }

    const sLat = Number(store.lat);
    const sLng = Number(store.lng);
    if (Number.isNaN(sLat) || Number.isNaN(sLng)) {
      return res.status(200).json({
        store: { id: store.id, name: store.name, type: store.type },
        offers: [],
        promotions: tablePromotions,
      });
    }

    const delta = 0.018;
    const latMin = sLat - delta;
    const latMax = sLat + delta;
    const lngMin = sLng - delta;
    const lngMax = sLng + delta;
    const promoThresholdKm = Math.max(
      0.08,
      Number.parseFloat(process.env.MAP_STORE_OFFERS_RADIUS_KM || '0.25') || 0.25
    );

    const defaultTtlHours = Math.max(
      1,
      Number.parseInt(process.env.MAP_DEFAULT_TTL_HOURS || '24', 10) || 24
    );
    const promoTtlHours = Math.max(
      1,
      Number.parseInt(process.env.MAP_STORE_OFFERS_PROMO_TTL_HOURS || '24', 10) || 24
    );
    const promoCutoffIso = new Date(Date.now() - promoTtlHours * 60 * 60 * 1000).toISOString();

    const baseSelect = 'id, product_name, price, store_name, lat, lng, category, created_at, user_id, product_id';

    const { data: promoRows, error: promoErr } = await supabase
      .from('price_points')
      .select(baseSelect)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .ilike('category', '%promo%')
      .gte('created_at', promoCutoffIso)
      .gte('lat', latMin)
      .lte('lat', latMax)
      .gte('lng', lngMin)
      .lte('lng', lngMax)
      .order('created_at', { ascending: false })
      .limit(800);

    if (promoErr) {
      console.error('store-offers price_points:', promoErr);
      return res.status(500).json({ error: promoErr.message });
    }

    let merged = [...(promoRows || [])].map((r) => ({ ...r, source: 'price_points' }));

    try {
      const { data: promoFromAgent, error: agentErr } = await supabase
        .from('promocoes_supermercados')
        .select(
          'id, nome_produto, preco, supermercado, lat, lng, atualizado_em, expira_em, imagem_url, product_id, categoria'
        )
        .eq('ativo', true)
        .gt('expira_em', new Date().toISOString())
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .gte('lat', latMin)
        .lte('lat', latMax)
        .gte('lng', lngMin)
        .lte('lng', lngMax)
        .gte('atualizado_em', promoCutoffIso)
        .order('atualizado_em', { ascending: false })
        .limit(600);

      if (agentErr) {
        console.warn('store-offers agent:', agentErr.message);
      } else if (promoFromAgent?.length) {
        const asPricePoints = promoFromAgent.map((r) => {
          const raw = r.preco;
          const priceNum =
            raw != null && raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : null;
          const slug = String(r.supermercado || '').toLowerCase();
          const storeName = slug === 'dia' ? 'Dia Supermercado' : `${agentLabel(r.supermercado)} · ofertas`;
          return {
            id: `promo-${r.id}`,
            product_name: r.nome_produto,
            price: priceNum,
            store_name: storeName,
            lat: r.lat,
            lng: r.lng,
            category: formatAgentPromoMapCategory(r.categoria),
            created_at: r.atualizado_em,
            user_id: null,
            product_id: r.product_id ?? null,
            imagem_url: r.imagem_url || null,
            source: 'agent_promotions',
          };
        });
        merged = merged.concat(asPricePoints);
      }
    } catch (e) {
      console.warn('store-offers promocoes_supermercados:', e.message);
    }

    const storeNameLower = String(store.name || '').toLowerCase();
    const normalizedStoreName = normalizeText(store.name);
    const isPaoStore = /(pao de acucar|minuto pao de acucar)/.test(normalizedStoreName);

    const belongs = (row) => {
      const pLat = Number(row.lat);
      const pLng = Number(row.lng);
      if (Number.isNaN(pLat) || Number.isNaN(pLng)) return false;
      const pStoreName = (row.store_name || '').toLowerCase();
      const normalizedPointStoreName = normalizeText(row.store_name);
      if (pStoreName && pStoreName === storeNameLower) return true;
      const distance = distanceKm(sLat, sLng, pLat, pLng);
      if (distance > promoThresholdKm) return false;
      if (isPaoStore && normalizedPointStoreName.includes('dia supermercado')) return false;
      if (isPaoStore) {
        const sameBrand =
          normalizedPointStoreName.includes('pao de acucar') ||
          normalizedPointStoreName.includes('minuto pao de acucar');
        if (!sameBrand) return false;
      }
      return true;
    };

    const filtered = merged.filter(belongs);

    const byId = new Map();
    for (const row of filtered) {
      if (row?.id != null) byId.set(row.id, row);
    }
    const deduped = Array.from(byId.values()).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    let pathByProductId = new Map();
    try {
      const productIds = [...new Set(deduped.map((r) => r.product_id).filter(Boolean))];
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
      return {
        id: row.id,
        product_name: row.product_name,
        price: row.price,
        store_name: row.store_name,
        lat: Number(row.lat),
        lng: Number(row.lng),
        category: row.category,
        time_ago: formatTimeAgo(row.created_at),
        observed_at: row.created_at,
        user_label: maskUserId(row.user_id),
        promo_image_url: promoUrl,
        source: row.source || 'unknown',
      };
    });

    if (process.env.MAP_POINTS_OFF_ENRICH !== '0') {
      const useCse =
        process.env.MAP_POINTS_GOOGLE_CSE_FALLBACK === '1' &&
        Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID);
      try {
        await enrichMapPointsImageUrls(offers, {
          maxUniqueNames: 32,
          concurrency: 4,
          useGoogleCse: useCse,
        });
      } catch (e) {
        console.warn('store-offers enrichMapPointsImageUrls:', e.message);
      }
    }

    return res.status(200).json({
      store: { id: store.id, name: store.name, type: store.type },
      offers,
      promotions: tablePromotions,
    });
  } catch (e) {
    console.error('GET /api/map/store-offers:', e);
    return res.status(500).json({ error: e.message || 'Erro ao carregar ofertas' });
  }
}

import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { isExcludedFromPriceMapStoreName } from '../../../lib/mapExcludedMapStores';
import { geocodeAddress } from '../../../lib/geocode';
import { bboxIsStateOrMacroRegion } from '../../../lib/saoPauloStateMap';
import { getPublicProductImageUrl } from '../../../lib/productImageUrl';
import { formatAgentPromoMapCategory } from '../../../lib/mapPromoCategory';
import { enrichMapPointsImageUrls } from '../../../lib/enrichMapPointImages';
import { hydratePointsFromImageCache } from '../../../lib/mapProductImageCache';
import { applyPeerPromoImageReuse } from '../../../lib/reuseMapProductImages';
import { isLikelyNonProductScraperTitle } from '../../../lib/mapStoreChainMatch';

/**
 * GET /api/map/points - lista pontos do mapa.
 * POST /api/map/points - divulgar preço (requer login; usa service role para evitar RLS).
 * user_id é mascarado como "Explorador #XXXX" no GET.
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

/** Viewport do mapa (sw/ne) — reduz payload e DOM quando o cliente envia bounds. Ignorado se houver busca textual (q). */
function parseBboxFromQuery(query) {
  const swLat = Number.parseFloat(query.sw_lat);
  const swLng = Number.parseFloat(query.sw_lng);
  const neLat = Number.parseFloat(query.ne_lat);
  const neLng = Number.parseFloat(query.ne_lng);
  if (![swLat, swLng, neLat, neLng].every((n) => Number.isFinite(n))) return null;
  if (Math.abs(swLat) > 90 || Math.abs(neLat) > 90 || Math.abs(swLng) > 180 || Math.abs(neLng) > 180) {
    return null;
  }
  const minLat = Math.min(swLat, neLat);
  const maxLat = Math.max(swLat, neLat);
  const minLng = Math.min(swLng, neLng);
  const maxLng = Math.max(swLng, neLng);
  if (maxLat - minLat < 0.0003 || maxLng - minLng < 0.0003) return null;
  if (maxLat - minLat > 30 || maxLng - minLng > 30) return null;
  return { minLat, maxLat, minLng, maxLng };
}

function applyLatLngBbox(qb, bbox) {
  if (!bbox) return qb;
  return qb
    .gte('lat', bbox.minLat)
    .lte('lat', bbox.maxLat)
    .gte('lng', bbox.minLng)
    .lte('lng', bbox.maxLng);
}

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.supabaseId;
    if (!userId) {
      return res.status(401).json({ error: 'Faça login para compartilhar preços.' });
    }
    const { product_name, price, store_name, lat, lng, category } = req.body || {};
    if (!product_name || typeof product_name !== 'string' || !product_name.trim()) {
      return res.status(400).json({ error: 'Informe o nome do produto.' });
    }
    if (price === undefined || price === null || isNaN(parseFloat(price))) {
      return res.status(400).json({ error: 'Informe o preço.' });
    }
    if (!store_name || typeof store_name !== 'string' || !store_name.trim()) {
      return res.status(400).json({ error: 'Informe o nome da loja.' });
    }
    const storeNameStr = String(store_name).trim();
    // Priorizar o endereço da loja (onde o preço foi visto), não a localização de quem divulgou
    let latNum = NaN;
    let lngNum = NaN;
    const coordsFromGeocode = await geocodeAddress(`${storeNameStr}, Brasil`) || await geocodeAddress(`${storeNameStr}, São Paulo, Brasil`);
    if (coordsFromGeocode && coordsFromGeocode.lat != null && coordsFromGeocode.lng != null) {
      latNum = coordsFromGeocode.lat;
      lngNum = coordsFromGeocode.lng;
    }
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      latNum = parseFloat(lat);
      lngNum = parseFloat(lng);
    }
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({ error: 'Não foi possível localizar a loja. Informe o endereço completo ou ative a localização.' });
    }
    try {
      const { error: insertErr } = await supabase.from('price_points').insert({
        user_id: userId,
        product_name: String(product_name).trim(),
        price: parseFloat(price),
        store_name: storeNameStr,
        lat: latNum,
        lng: lngNum,
        category: category && String(category).trim() ? String(category).trim() : null
      });
      if (insertErr) {
        console.error('Erro ao inserir price_point:', insertErr);
        return res.status(500).json({ error: insertErr.message || 'Erro ao salvar.' });
      }
      return res.status(201).json({ success: true });
    } catch (e) {
      console.error('POST /api/map/points:', e);
      return res.status(500).json({ error: e.message || 'Erro ao salvar.' });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const q = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    // Com busca textual: não limitar ao viewport (usuário quer achar oferta em qualquer região).
    const bbox = q.length >= 2 ? null : parseBboxFromQuery(req.query || {});
    const stateScale = bboxIsStateOrMacroRegion(bbox);
    const rowLimitCeil = stateScale
      ? Math.min(
          2000,
          Math.max(400, Number.parseInt(process.env.MAP_POINTS_BBOX_ROW_LIMIT_LARGE || '900', 10) || 900)
        )
      : Math.min(
          500,
          Math.max(50, Number.parseInt(process.env.MAP_POINTS_BBOX_ROW_LIMIT || '320', 10) || 320)
        );
    const rowLimit = bbox ? rowLimitCeil : 500;
    const outCapCeil = stateScale
      ? Math.min(
          2500,
          Math.max(600, Number.parseInt(process.env.MAP_POINTS_BBOX_OUT_CAP_LARGE || '1400', 10) || 1400)
        )
      : Math.min(
          500,
          Math.max(80, Number.parseInt(process.env.MAP_POINTS_BBOX_OUT_CAP || '320', 10) || 320)
        );
    const outCap = bbox ? outCapCeil : 500;

    // TTL padrão: 24h (preços divulgados por usuários).
    const defaultTtlHours = Math.max(
      1,
      Number.parseInt(process.env.MAP_DEFAULT_TTL_HOURS || '24', 10) || 24
    );
    // Promoções (ex.: import DIA — category com "promo") ficam mais tempo no ar.
    const promoTtlHours = Math.max(
      defaultTtlHours,
      Number.parseInt(process.env.MAP_PROMO_TTL_HOURS || '168', 10) || 168
    );
    const normalCutoffIso = new Date(
      Date.now() - defaultTtlHours * 60 * 60 * 1000
    ).toISOString();
    const promoCutoffIso = new Date(
      Date.now() - promoTtlHours * 60 * 60 * 1000
    ).toISOString();

    // Não incluir image_url aqui: em bases sem a migração a coluna quebra o SELECT e o mapa fica vazio.
    // imagem_url do agente vem de promocoes_supermercados; image_url em price_points é opcional (merge abaixo).
    const baseSelect =
      'id, product_name, price, store_name, lat, lng, category, created_at, user_id, product_id';

    const applySearch = (qb) => {
      if (q.length < 2) return qb;
      const pattern = `%${q}%`;
      return qb.or(
        `product_name.ilike.${pattern},store_name.ilike.${pattern},category.ilike.${pattern}`
      );
    };

    // 1) Ofertas/promoções (import DIA etc.): TTL maior — bbox antes de order/limit (PostgREST)
    let promoQuery = applySearch(
      applyLatLngBbox(
        supabase
          .from('price_points')
          .select(baseSelect)
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .ilike('category', '%promo%')
          .gte('created_at', promoCutoffIso),
        bbox
      )
    )
      .order('created_at', { ascending: false })
      .limit(rowLimit);

    // 2) Demais pontos: TTL curto (categoria sem "promo" ou nula) — duas queries para evitar edge cases do PostgREST
    let normalNullQuery = applySearch(
      applyLatLngBbox(
        supabase
          .from('price_points')
          .select(baseSelect)
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .is('category', null)
          .gte('created_at', normalCutoffIso),
        bbox
      )
    )
      .order('created_at', { ascending: false })
      .limit(rowLimit);
    let normalOtherQuery = applySearch(
      applyLatLngBbox(
        supabase
          .from('price_points')
          .select(baseSelect)
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .not('category', 'ilike', '%promo%')
          .gte('created_at', normalCutoffIso),
        bbox
      )
    )
      .order('created_at', { ascending: false })
      .limit(rowLimit);

    const [
      { data: promoRows, error: promoErr },
      { data: normalNullRows, error: normalNullErr },
      { data: normalOtherRows, error: normalOtherErr },
    ] = await Promise.all([promoQuery, normalNullQuery, normalOtherQuery]);

    if (promoErr) {
      console.error('Erro ao buscar price_points (promo):', promoErr);
      return res.status(500).json({ error: promoErr.message });
    }
    if (normalNullErr) {
      console.error('Erro ao buscar price_points (normal null):', normalNullErr);
      return res.status(500).json({ error: normalNullErr.message });
    }
    if (normalOtherErr) {
      console.error('Erro ao buscar price_points (normal):', normalOtherErr);
      return res.status(500).json({ error: normalOtherErr.message });
    }

    const byId = new Map();
    for (const row of [
      ...(promoRows || []),
      ...(normalNullRows || []),
      ...(normalOtherRows || []),
    ]) {
      if (!row?.id) continue;
      if (isExcludedFromPriceMapStoreName(row.store_name)) continue;
      if (isLikelyNonProductScraperTitle(row.product_name)) continue;
      byId.set(row.id, row);
    }
    /** Promoções primeiro ao aplicar outCap — evita “sumirem” quando há muitos preços normais na mesma área. */
    const isPromoRow = (row) => {
      const c = String(row?.category || '').toLowerCase();
      if (c.includes('promo')) return true;
      if (String(row?.id || '').startsWith('promo-')) return true;
      return false;
    };
    const merged = Array.from(byId.values()).sort((a, b) => {
      const pa = isPromoRow(a) ? 1 : 0;
      const pb = isPromoRow(b) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    let data = merged.slice(0, outCap);

    // Promoções do agente (tabloides / import) — mesma forma que price_points para o mapa
    try {
      let promoAgentQ = applyLatLngBbox(
        supabase
          .from('promocoes_supermercados')
          .select(
            'id, nome_produto, preco, supermercado, lat, lng, atualizado_em, expira_em, imagem_url, product_id, categoria'
          )
          .eq('ativo', true)
          .gt('expira_em', new Date().toISOString())
          .not('lat', 'is', null)
          .not('lng', 'is', null),
        bbox
      )
        .order('atualizado_em', { ascending: false })
        .limit(bbox ? Math.min(stateScale ? 1400 : 200, rowLimit) : 300);
      const { data: promoFromAgent, error: promoTableErr } = await promoAgentQ;

      if (promoTableErr) {
        console.warn('promocoes_supermercados (mapa):', promoTableErr.message);
      } else if (promoFromAgent && promoFromAgent.length) {
        const label = (s) =>
          ({
            dia: 'Dia',
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
            padraosuper: 'Supermercado Padrão',
          }[String(s || '').toLowerCase()] || String(s || 'Rede'));
        const asPricePoints = promoFromAgent
          .filter((r) => !isLikelyNonProductScraperTitle(r.nome_produto))
          .map((r) => {
          const raw = r.preco;
          const priceNum =
            raw != null && raw !== '' && !Number.isNaN(Number(raw))
              ? Number(raw)
              : null;
          const slug = String(r.supermercado || '').toLowerCase();
          // DIA: mesmo nome que pins em public.stores → /api/map/stores marca tem_oferta_hoje por nome.
          const storeName =
            slug === 'dia' ? 'Dia Supermercado' : `${label(r.supermercado)} · ofertas`;
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
          };
        });
        const byIdPromo = new Map(data.map((row) => [row.id, row]));
        for (const row of asPricePoints) {
          if (isExcludedFromPriceMapStoreName(row.store_name)) continue;
          if (!byIdPromo.has(row.id)) byIdPromo.set(row.id, row);
        }
        data = Array.from(byIdPromo.values()).sort((a, b) => {
          const pa = isPromoRow(a) ? 1 : 0;
          const pb = isPromoRow(b) ? 1 : 0;
          if (pa !== pb) return pb - pa;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        data = data.slice(0, outCap);
      }
    } catch (e) {
      console.warn('promocoes_supermercados merge:', e.message);
    }

    /**
     * Fallback de imagem no mapa:
     * 1) bucket próprio (product_images primária)
     * 2) imagem_url do scraping/agent
     * 3) Open Food Facts via GTIN do produto
     * 4) frontend exibe ícone genérico por categoria
     */
    let pathByProductId = new Map();
    try {
      const productIds = [
        ...new Set((data || []).map((r) => r.product_id).filter(Boolean)),
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
    } catch (e) {
      console.warn('product_images/products (mapa):', e.message);
    }

    const points = (data || []).map((row) => {
      let promoUrl = row.imagem_url || row.image_url || null;
      const pid = row.product_id;
      if (pid && pathByProductId.has(pid)) {
        const fromCatalog = getPublicProductImageUrl(pathByProductId.get(pid));
        if (fromCatalog) promoUrl = fromCatalog;
      }
      // Não usar URL sintética por GTIN (getOpenFoodFactsImageUrl): muitas devolvem 404 no <img>
      // e impediam o enriquecimento por nome (Open Food Facts) abaixo.
      return {
        id: row.id,
        product_name: row.product_name,
        price: row.price,
        store_name: row.store_name,
        lat: Number(row.lat),
        lng: Number(row.lng),
        category: row.category,
        time_ago: formatTimeAgo(row.created_at),
        user_label: maskUserId(row.user_id),
        promo_image_url: promoUrl,
      };
    });

    applyPeerPromoImageReuse(points);

    try {
      await hydratePointsFromImageCache(supabase, points);
    } catch (e) {
      console.warn('hydratePointsFromImageCache:', e.message);
    }

    // Miniatura por nome (Open Food Facts; opcional Google CSE) quando ainda falta foto exibível.
    if (process.env.MAP_POINTS_OFF_ENRICH !== '0') {
      const stateWide = stateScale;
      const maxNames = stateWide
        ? Math.min(8, Number.parseInt(process.env.MAP_POINTS_MAX_OFF_NAMES_STATE || '8', 10) || 8)
        : q.length >= 2
          ? Math.min(36, Number.parseInt(process.env.MAP_POINTS_MAX_OFF_NAMES_SEARCH || '28', 10) || 28)
          : Math.min(32, Number.parseInt(process.env.MAP_POINTS_MAX_OFF_NAMES || '24', 10) || 24);
      const useCse =
        process.env.MAP_POINTS_GOOGLE_CSE_FALLBACK === '1' &&
        Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID);
      try {
        await enrichMapPointsImageUrls(points, {
          maxUniqueNames: maxNames,
          concurrency: stateWide ? 3 : 4,
          useGoogleCse: useCse,
        });
      } catch (e) {
        console.warn('enrichMapPointsImageUrls:', e.message);
      }
    }

    return res.status(200).json({ points });
  } catch (e) {
    console.error('Erro em /api/map/points:', e);
    return res.status(500).json({ error: e.message });
  }
}

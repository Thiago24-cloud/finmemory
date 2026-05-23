import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { DIA_SCRAPER_STORES } from '../../../lib/diaScraper/storesCatalog.js';
import {
  SCRAPER_DIA_ORIGEM,
  extractOffersViaVision,
  fetchDiaPageDataJson,
  insertApprovedFilaAndPublishScraperDia,
  mapOfertasToProdutosFila,
  nextSundayYmdBrazil,
  resolveStoreLatLng,
  toIsoDateOnly,
  inferLocalityForCity,
} from '../../../lib/diaScraper/scraperDiaCore.js';
import { resolveOwnerUserId } from '../../../lib/botPromoOwner.js';

function requireCronSecret(req) {
  const importSecret = process.env.DIA_IMPORT_SECRET;
  const providedSecret =
    req.headers['x-cron-secret'] ||
    req.headers['X-Cron-Secret'] ||
    req.query?.secret;
  if (importSecret && providedSecret !== importSecret) {
    return { ok: false, status: 403, body: { error: 'Forbidden' } };
  }
  return { ok: true };
}

/**
 * POST /api/scraper/dia
 * Body opcional: { storeIds?: string[] } — ids do catálogo (`lib/diaScraper/storesCatalog.js`). Omite = todas as lojas.
 * Query: ?secret= — se DIA_IMPORT_SECRET estiver definido.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gate = requireCronSecret(req);
  if (!gate.ok) return res.status(gate.status).json(gate.body);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role não configurado' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const ownerUserId = await resolveOwnerUserId(supabase, null);
  if (!ownerUserId) {
    return res.status(500).json({
      error:
        'Configure BOT_PROMO_OWNER_USER_ID ou MAP_QUICK_ADD_BOT_USER_ID com UUID válido em public.users para publicar no mapa.',
    });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const requestedIds = Array.isArray(body.storeIds) ? body.storeIds.map(String) : null;
  const stores = requestedIds?.length
    ? DIA_SCRAPER_STORES.filter((s) => requestedIds.includes(s.id))
    : DIA_SCRAPER_STORES;

  if (requestedIds?.length && stores.length === 0) {
    return res.status(400).json({ error: 'Nenhum storeIds corresponde ao catálogo', requestedIds });
  }

  const runId = randomUUID();
  const sundayFallbackYmd = nextSundayYmdBrazil();
  const results = [];

  for (const store of stores) {
    const one = {
      storeId: store.id,
      storeName: store.storeName,
      storeUrl: store.storeUrl,
      ok: false,
    };

    try {
      const coords = await resolveStoreLatLng(store);
      if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
        one.error = 'Geocoding não retornou lat/lng';
        results.push(one);
        continue;
      }

      let pageData;
      try {
        pageData = await fetchDiaPageDataJson(store.storeUrl);
      } catch (e) {
        one.error = `page-data.json: ${e?.message || 'falha ao buscar dados da loja'}`;
        results.push(one);
        continue;
      }

      const tabloide = pageData?.result?.data?.tabloide;
      if (!tabloide) {
        one.error = 'page-data.json sem campo tabloide';
        results.push(one);
        continue;
      }

      const offerItems = Array.isArray(tabloide.offer) ? tabloide.offer : [];
      const finishDateIso = toIsoDateOnly(tabloide.finishDate) || sundayFallbackYmd;

      const imageUrls = offerItems
        .map((o) => {
          const src = o?.image?.childImageSharp?.gatsbyImageData?.images?.fallback?.src;
          return src ? `https://www.dia.com.br${src}` : null;
        })
        .filter(Boolean);

      if (imageUrls.length === 0) {
        one.error = 'Nenhuma imagem de oferta encontrada no page-data.json';
        results.push(one);
        continue;
      }

      let ofertas;
      try {
        ofertas = await extractOffersViaVision(apiKey, imageUrls, finishDateIso);
      } catch (e) {
        one.error = `Haiku vision: ${e?.message || 'falha na extração'}`;
        results.push(one);
        continue;
      }

      const produtos = mapOfertasToProdutosFila(ofertas, sundayFallbackYmd, imageUrls);

      if (produtos.length === 0) {
        one.error = 'Nenhuma oferta extraída das imagens';
        one.imagesFound = imageUrls.length;
        one.ofertasRaw = ofertas.length;
        results.push(one);
        continue;
      }

      const loc = inferLocalityForCity(store.city);
      const filaRow = {
        store_name: store.storeName,
        store_address: store.addressForGeocode,
        store_lat: coords.lat,
        store_lng: coords.lng,
        locality_scope: loc.locality_scope,
        locality_city: loc.locality_city,
        locality_region: loc.locality_region,
        locality_state: loc.locality_state,
        ddd_code: loc.ddd_code,
        is_statewide: loc.is_statewide,
        produtos,
        artifacts: {
          source_page_url: store.storeUrl,
          run_id: runId,
          cnpj: store.cnpj,
          finish_date: finishDateIso,
          images_found: imageUrls.length,
          origem: SCRAPER_DIA_ORIGEM,
        },
      };

      const published = await insertApprovedFilaAndPublishScraperDia(supabase, filaRow, ownerUserId);
      if (!published.ok) {
        one.error = published.error;
        one.step = published.step;
        one.filaId = published.filaId;
        results.push(one);
        continue;
      }

      one.ok = true;
      one.filaId = published.filaId;
      one.inserted = published.inserted;
      one.offersTotal = published.offersTotal;
      one.invalidPrice = published.invalidPrice;
      one.note = published.note;
      one.autoPublished = published.autoPublished;
      one.finishDate = finishDateIso;
      results.push(one);
    } catch (e) {
      one.error = e?.message || 'Erro desconhecido';
      results.push(one);
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return res.status(200).json({
    success: okCount === results.length,
    runId,
    sundayFallbackYmd,
    storesProcessed: results.length,
    storesOk: okCount,
    results,
  });
}

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { resolveDiaScraperStores } from '../../../lib/diaScraper/fetchDiaCatalogStores.js';
import {
  SCRAPER_DIA_ORIGEM,
  extractOffersViaVision,
  fetchDiaPageDataJson,
  mapOfertasToProdutosFila,
  nextSundayYmdBrazil,
  resolveStoreLatLng,
  toIsoDateOnly,
  inferLocalityForCity,
} from '../../../lib/diaScraper/scraperDiaCore.js';
import { enqueueScraperRun } from '../../../lib/ingest/enqueueScraperRun.js';

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
 * Body opcional:
 *   { storeIds?: string[] } — lojas específicas
 *   { all?: true } — todas as lojas SP do site (lento; use com cuidado)
 *   { batchSize?: number, batchIndex?: number } — lote rotativo (padrão do cron)
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
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  let catalogMeta;
  try {
    catalogMeta = await resolveDiaScraperStores({
      storeIds: Array.isArray(body.storeIds) ? body.storeIds.map(String) : undefined,
      all: body.all === true,
      batchSize: body.batchSize,
      batchIndex: body.batchIndex,
    });
  } catch (e) {
    return res.status(502).json({ error: `Catálogo DIA: ${e?.message || 'falha ao listar lojas'}` });
  }

  const stores = catalogMeta.stores || [];
  if (Array.isArray(body.storeIds) && body.storeIds.length && stores.length === 0) {
    return res.status(400).json({
      error: 'Nenhum storeIds corresponde ao catálogo oficial',
      requestedIds: body.storeIds,
      catalogTotal: catalogMeta.catalogTotal,
    });
  }

  if (!stores.length) {
    return res.status(502).json({ error: 'Catálogo DIA vazio', catalogTotal: catalogMeta.catalogTotal });
  }

  const runId = randomUUID();
  const sundayFallbackYmd = nextSundayYmdBrazil();
  const results = new Array(stores.length);
  const concurrency = Math.max(1, Math.min(6, Number(body.concurrency || process.env.SCRAPER_DIA_CONCURRENCY || 2)));
  const storeDelayMs = Math.max(0, Number(body.storeDelayMs || process.env.SCRAPER_DIA_STORE_DELAY_MS || 350));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const normalizeAddress = (value) =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .trim();
  const distanceKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const maybeMatchStoreByCoords = async (storeName, lat, lng) => {
    const latMin = lat - 0.012;
    const latMax = lat + 0.012;
    const lngMin = lng - 0.012;
    const lngMax = lng + 0.012;
    const nameToken = String(storeName || 'DIA').slice(0, 40);
    const { data, error } = await supabase
      .from('stores')
      .select('id, name, lat, lng, address')
      .ilike('name', `%${nameToken.split(' ')[0] || 'DIA'}%`)
      .gte('lat', latMin)
      .lte('lat', latMax)
      .gte('lng', lngMin)
      .lte('lng', lngMax)
      .limit(20);
    if (error || !Array.isArray(data) || data.length === 0) return null;
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const row of data) {
      const d = distanceKm(lat, lng, Number(row.lat), Number(row.lng));
      if (d < bestDist) {
        bestDist = d;
        best = row;
      }
    }
    if (!best || bestDist > 0.6) return null;
    return {
      storeId: best.id,
      storeName: best.name,
      lat: Number(best.lat),
      lng: Number(best.lng),
      address: best.address || null,
      distanceKm: Number(bestDist.toFixed(4)),
    };
  };

  let cursor = 0;
  async function processStore(index) {
    const store = stores[index];
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
        results[index] = one;
        return;
      }

      let pageData;
      try {
        pageData = await fetchDiaPageDataJson(store.storeUrl);
      } catch (e) {
        one.error = `page-data.json: ${e?.message || 'falha ao buscar dados da loja'}`;
        results[index] = one;
        return;
      }

      const tabloide = pageData?.result?.data?.tabloide;
      if (!tabloide) {
        one.error = 'page-data.json sem campo tabloide';
        results[index] = one;
        return;
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
        results[index] = one;
        return;
      }

      let ofertas;
      try {
        ofertas = await extractOffersViaVision(apiKey, imageUrls, finishDateIso);
      } catch (e) {
        one.error = `Haiku vision: ${e?.message || 'falha na extração'}`;
        results[index] = one;
        return;
      }

      const extractedAt = new Date().toISOString();
      const produtos = mapOfertasToProdutosFila(ofertas, sundayFallbackYmd, imageUrls, extractedAt);

      if (produtos.length === 0) {
        one.error = 'Nenhuma oferta extraída das imagens';
        one.imagesFound = imageUrls.length;
        one.ofertasRaw = ofertas.length;
        results[index] = one;
        return;
      }

      const storeMatch = await maybeMatchStoreByCoords(store.storeName, coords.lat, coords.lng);
      const resolvedStoreName = storeMatch?.storeName || store.storeName;
      const resolvedLat = Number.isFinite(storeMatch?.lat) ? storeMatch.lat : coords.lat;
      const resolvedLng = Number.isFinite(storeMatch?.lng) ? storeMatch.lng : coords.lng;
      const resolvedAddress = normalizeAddress(storeMatch?.address || store.addressForGeocode);
      const loc = inferLocalityForCity(store.city);
      const queued = await enqueueScraperRun(supabase, {
        origem: SCRAPER_DIA_ORIGEM,
        storeName: resolvedStoreName,
        storeAddress: resolvedAddress,
        storeLat: resolvedLat,
        storeLng: resolvedLng,
        localityScope: loc.locality_scope,
        localityCity: loc.locality_city,
        localityRegion: loc.locality_region,
        localityState: loc.locality_state,
        dddCode: loc.ddd_code,
        isStatewide: loc.is_statewide,
        produtos,
        artifacts: {
          source_page_url: store.storeUrl,
          run_id: runId,
          cnpj: store.cnpj,
          finish_date: finishDateIso,
          images_found: imageUrls.length,
          image_urls: imageUrls,
          thumbnail_url: imageUrls[0] || null,
          extracted_at: extractedAt,
          store_address_normalized: resolvedAddress,
          matched_store: storeMatch,
          origem: SCRAPER_DIA_ORIGEM,
        },
      });
      if (!queued.ok) {
        one.error = queued.error;
        results[index] = one;
        return;
      }

      one.ok = true;
      one.filaId = queued.filaId;
      one.offersTotal = produtos.length;
      one.status = queued.status;
      one.readiness = queued.readiness;
      one.note = 'Publicado automaticamente no mapa após validação do scraper';
      one.inserted = queued.inserted || 0;
      one.finishDate = finishDateIso;
      one.thumbnailUrl = imageUrls[0] || null;
      one.storeMappedByCoords = storeMatch || null;
      results[index] = one;
    } catch (e) {
      one.error = e?.message || 'Erro desconhecido';
      results[index] = one;
    }
  }

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= stores.length) return;
      if (index > 0 && storeDelayMs > 0) await sleep(storeDelayMs);
      // eslint-disable-next-line no-await-in-loop
      await processStore(index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, stores.length) }, () => worker()));

  const okCount = results.filter((r) => r.ok).length;
  return res.status(200).json({
    success: okCount === results.length,
    runId,
    sundayFallbackYmd,
    catalogTotal: catalogMeta.catalogTotal,
    catalogMode: catalogMeta.mode,
    batchSize: catalogMeta.batchSize || stores.length,
    storesProcessed: results.length,
    storesOk: okCount,
    concurrency,
    storeDelayMs,
    results,
  });
}

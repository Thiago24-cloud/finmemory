import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { resolveAtacadaoScraperStores } from '../../../lib/atacadaoScraper/fetchAtacadaoCatalogStores.js';
import {
  SCRAPER_ATACADAO_ORIGEM,
  fetchAllStoreProducts,
  insertApprovedFilaAndPublishScraperAtacadao,
  mapVtexProductsToProdutosFila,
  nextSundayYmdBrazil,
  resolveAtacadaoStoreLatLng,
  inferLocalityForCity,
} from '../../../lib/atacadaoScraper/scraperAtacadaoCore.js';
import { resolveOwnerUserId } from '../../../lib/botPromoOwner.js';

function requireCronSecret(req) {
  const importSecret = process.env.ATACADAO_IMPORT_SECRET;
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
 * POST /api/scraper/atacadao
 * Body opcional: { storeIds?, all?, batchSize?, batchIndex? } — ver resolveAtacadaoScraperStores
 * Query: ?secret= — se ATACADAO_IMPORT_SECRET estiver definido.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gate = requireCronSecret(req);
  if (!gate.ok) return res.status(gate.status).json(gate.body);

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

  let catalogMeta;
  try {
    catalogMeta = await resolveAtacadaoScraperStores({
      storeIds: Array.isArray(body.storeIds) ? body.storeIds.map(String) : undefined,
      all: body.all === true,
      batchSize: body.batchSize,
      batchIndex: body.batchIndex,
    });
  } catch (e) {
    return res.status(502).json({ error: `Catálogo Atacadão: ${e?.message || 'falha ao listar lojas'}` });
  }

  const stores = catalogMeta.stores || [];
  if (Array.isArray(body.storeIds) && body.storeIds.length && stores.length === 0) {
    return res.status(400).json({
      error: 'Nenhum storeIds corresponde ao catálogo',
      requestedIds: body.storeIds,
      catalogTotal: catalogMeta.catalogTotal,
    });
  }

  if (!stores.length) {
    return res.status(502).json({ error: 'Catálogo Atacadão vazio', catalogTotal: catalogMeta.catalogTotal });
  }

  const runId = randomUUID();
  const sundayFallbackYmd = nextSundayYmdBrazil();
  const results = [];

  for (const store of stores) {
    const one = {
      storeId: store.id,
      storeName: store.storeName,
      cep: store.cep,
      ok: false,
    };

    try {
      const coords = await resolveAtacadaoStoreLatLng(store);
      if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
        one.error = 'Geocoding não retornou lat/lng';
        results.push(one);
        continue;
      }

      let vtexProducts;
      try {
        const result = await fetchAllStoreProducts(store.cep);
        vtexProducts = result.products;
      } catch (e) {
        one.error = `VTEX API: ${e?.message || 'falha ao buscar produtos'}`;
        results.push(one);
        continue;
      }

      if (!vtexProducts || vtexProducts.length === 0) {
        one.error = 'VTEX não retornou produtos para este CEP';
        results.push(one);
        continue;
      }

      const produtos = mapVtexProductsToProdutosFila(vtexProducts, store.cnpj, sundayFallbackYmd);

      if (produtos.length === 0) {
        one.error = 'Nenhum produto com preço válido após mapeamento';
        one.vtexProductsTotal = vtexProducts.length;
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
          source: 'vtex_catalog_api',
          run_id: runId,
          cnpj: store.cnpj,
          cep: store.cep,
          vtex_products_total: vtexProducts.length,
          origem: SCRAPER_ATACADAO_ORIGEM,
        },
      };

      const published = await insertApprovedFilaAndPublishScraperAtacadao(supabase, filaRow, ownerUserId);
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
      one.vtexProductsTotal = vtexProducts.length;
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
    catalogTotal: catalogMeta.catalogTotal,
    catalogMode: catalogMeta.mode,
    batchSize: catalogMeta.batchSize || stores.length,
    storesProcessed: results.length,
    storesOk: okCount,
    results,
  });
}

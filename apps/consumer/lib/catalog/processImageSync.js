import { resolveCosmosImageForProduct } from './cosmosProductImageLookup.js';
import { ingestRemoteImageToR2 } from './ingestRemoteImageToR2.js';
import { upsertImageCacheRow, getCachedImageUrlFromDb } from '../mapProductImageCache.js';
import { isCatalogR2PublicUrl, isLikelyEnrichableProductName } from './catalogImageUrls.js';

const CACHE_SOURCE_R2 = 'catalog_r2';

function pickImageUrl(product) {
  return (
    String(product?.imagem_url || product?.image_url || product?.promo_image_url || '').trim() || null
  );
}

function pickName(product) {
  return (
    String(product?.nome || product?.name || product?.product_name || product?._normalized_name || '').trim() ||
    null
  );
}

function hasTentativaBusca(product) {
  return Boolean(
    product?.tentativa_busca === true ||
      product?.tentativa_busca_imagem === true ||
      product?.tentativa_busca === 'true'
  );
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id?: string, nome?: string, name?: string, imagem_url?: string, image_url?: string, gtin?: string, tentativa_busca?: boolean, persist?: { table: string, id?: string, filaId?: string, index?: number } }} product
 * @param {{ storeName?: string, skipPersist?: boolean }} [options]
 * @returns {Promise<{ status: string, imagem_url?: string | null, tentativa_busca?: boolean, source?: string, error?: string }>}
 */
export async function processImageSync(supabase, product, options = {}) {
  const existing = pickImageUrl(product);
  if (existing && isCatalogR2PublicUrl(existing)) {
    return { status: 'skipped', imagem_url: existing, reason: 'already_r2' };
  }

  if (hasTentativaBusca(product)) {
    return { status: 'skipped', reason: 'tentativa_busca', tentativa_busca: true };
  }

  const name = pickName(product);
  if (!name) {
    return { status: 'skipped', reason: 'missing_name' };
  }

  const seed = String(product?.gtin || product?.ean || name).trim();

  /** URL externa (scraper/CDN) → repositório R2 */
  if (existing && !isCatalogR2PublicUrl(existing)) {
    const rehostExisting = await ingestRemoteImageToR2(existing, seed);
    if (rehostExisting?.url) {
      await upsertImageCacheRow(supabase, name, rehostExisting.url, CACHE_SOURCE_R2);
      if (!options.skipPersist && supabase) {
        await persistEnrichedImage(supabase, product, rehostExisting.url, options);
      }
      return { status: 'enriched', imagem_url: rehostExisting.url, source: 'rehost_r2' };
    }
  }

  if (!isLikelyEnrichableProductName(name)) {
    const flagged = await persistTentativaBusca(supabase, product, options);
    return { status: 'not_found', tentativa_busca: true, reason: 'invalid_name', persisted: flagged };
  }

  /** 1) Repositório FinMemory (cache → URL R2) */
  const cached = await getCachedImageUrlFromDb(supabase, name);
  if (cached) {
    if (isCatalogR2PublicUrl(cached)) {
      if (!options.skipPersist && supabase) {
        await persistEnrichedImage(supabase, product, cached, options);
      }
      return { status: 'enriched', imagem_url: cached, source: 'cache_r2' };
    }
    const rehost = await ingestRemoteImageToR2(cached, seed);
    if (rehost?.url) {
      await upsertImageCacheRow(supabase, name, rehost.url, CACHE_SOURCE_R2);
      if (!options.skipPersist && supabase) {
        await persistEnrichedImage(supabase, product, rehost.url, options);
      }
      return { status: 'enriched', imagem_url: rehost.url, source: 'cache_rehost_r2' };
    }
  }

  /** 2) Cosmos → sempre tentar gravar no R2 (repositório canónico) */
  const cosmos = await resolveCosmosImageForProduct(product);
  if (!cosmos?.imageUrl) {
    const flagged = await persistTentativaBusca(supabase, product, options);
    return { status: 'not_found', tentativa_busca: true, persisted: flagged };
  }

  const r2 = await ingestRemoteImageToR2(cosmos.imageUrl, seed);
  if (!r2?.url) {
    console.warn('[processImageSync] R2 falhou; produto sem imagem canónica:', name.slice(0, 80));
    const flagged = await persistTentativaBusca(supabase, product, options);
    return {
      status: 'not_found',
      tentativa_busca: true,
      reason: 'r2_upload_failed',
      persisted: flagged,
    };
  }

  const finalUrl = r2.url;

  if (!options.skipPersist && supabase) {
    await persistEnrichedImage(supabase, product, finalUrl, options);
    try {
      await upsertImageCacheRow(supabase, name, finalUrl, CACHE_SOURCE_R2);
    } catch (e) {
      console.warn('[processImageSync] cache:', e?.message || e);
    }
  }

  return {
    status: 'enriched',
    imagem_url: finalUrl,
    source: CACHE_SOURCE_R2,
    cosmos_source: cosmos.source,
    r2_key: r2.key,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} product
 * @param {string} imageUrl
 * @param {{ storeName?: string }} options
 */
async function persistEnrichedImage(supabase, product, imageUrl, options) {
  const persist = product?.persist;
  if (persist?.table === 'promocoes_supermercados' && persist.id) {
    await supabase
      .from('promocoes_supermercados')
      .update({ imagem_url: imageUrl, tentativa_busca_imagem: false })
      .eq('id', persist.id);
    return;
  }

  if (persist?.table === 'price_points' && persist.id) {
    await supabase
      .from('price_points')
      .update({ image_url: imageUrl, tentativa_busca_imagem: false })
      .eq('id', persist.id);
    return;
  }

  if (persist?.table === 'bot_promocoes_fila' && persist.filaId != null && persist.index != null) {
    const { data: row } = await supabase
      .from('bot_promocoes_fila')
      .select('produtos')
      .eq('id', persist.filaId)
      .maybeSingle();
    const produtos = Array.isArray(row?.produtos) ? [...row.produtos] : [];
    const idx = Number(persist.index);
    if (produtos[idx]) {
      produtos[idx] = {
        ...produtos[idx],
        imagem_url: imageUrl,
        image_url: imageUrl,
        tentativa_busca: false,
      };
      await supabase.from('bot_promocoes_fila').update({ produtos }).eq('id', persist.filaId);
    }
    return;
  }

  if (product?.id && !persist) {
    await supabase
      .from('promocoes_supermercados')
      .update({ imagem_url: imageUrl, tentativa_busca_imagem: false })
      .eq('id', product.id);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} product
 */
async function persistTentativaBusca(supabase, product, options) {
  if (!supabase) return false;
  const persist = product?.persist;

  if (persist?.table === 'promocoes_supermercados' && persist.id) {
    await supabase
      .from('promocoes_supermercados')
      .update({ tentativa_busca_imagem: true })
      .eq('id', persist.id);
    return true;
  }

  if (persist?.table === 'bot_promocoes_fila' && persist.filaId != null && persist.index != null) {
    const { data: row } = await supabase
      .from('bot_promocoes_fila')
      .select('produtos')
      .eq('id', persist.filaId)
      .maybeSingle();
    const produtos = Array.isArray(row?.produtos) ? [...row.produtos] : [];
    const idx = Number(persist.index);
    if (produtos[idx]) {
      produtos[idx] = { ...produtos[idx], tentativa_busca: true };
      await supabase.from('bot_promocoes_fila').update({ produtos }).eq('id', persist.filaId);
    }
    return true;
  }

  if (persist?.table === 'price_points' && persist.id) {
    await supabase
      .from('price_points')
      .update({ tentativa_busca_imagem: true })
      .eq('id', persist.id);
    return true;
  }

  if (product?.id) {
    await supabase
      .from('promocoes_supermercados')
      .update({ tentativa_busca_imagem: true })
      .eq('id', product.id);
    return true;
  }

  return false;
}

/**
 * Enriquece vários produtos em série (worker / fila).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object[]} products
 * @param {object} [options]
 */
export async function processImageSyncBatch(supabase, products, options = {}) {
  const results = [];
  for (let i = 0; i < products.length; i += 1) {
    const p = products[i];
    // eslint-disable-next-line no-await-in-loop
    const result = await processImageSync(supabase, p, options);
    results.push({ index: i, nome: pickName(p), ...result });
  }
  return results;
}

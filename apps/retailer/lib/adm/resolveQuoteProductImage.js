/**
 * Resolve foto do produto para orçamento WhatsApp.
 * Ordem: map_product_image_cache → Open Food Facts (nome) → Cosmos (consumer) → grava cache.
 */

import {
  resolveCosmosProductImage,
  isCosmosConsumerUnavailableError,
} from '../merchant/cosmosConsumerClient';

const OFF_UA = 'FinMemory/1.0 (https://finmemory.com.br; adm-whatsapp-quote)';

export function normalizeMapProductImageKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

function isValidImageUrl(url) {
  const u = String(url || '').trim();
  if (!/^https:\/\//i.test(u)) return false;
  if (/^data:/i.test(u)) return false;
  return true;
}

async function getCached(supabase, productName) {
  const normKey = normalizeMapProductImageKey(productName);
  if (normKey.length < 2) return null;
  const { data, error } = await supabase
    .from('map_product_image_cache')
    .select('image_url, source')
    .eq('norm_key', normKey)
    .maybeSingle();
  if (error || !data?.image_url) return null;
  if (!isValidImageUrl(data.image_url)) return null;
  return { url: String(data.image_url).trim(), source: data.source || 'cache' };
}

async function upsertCache(supabase, productName, imageUrl, source) {
  const normKey = normalizeMapProductImageKey(productName);
  const u = String(imageUrl || '').trim();
  if (normKey.length < 2 || !isValidImageUrl(u)) return false;
  const { error } = await supabase.from('map_product_image_cache').upsert(
    {
      norm_key: normKey,
      display_name: String(productName || '').trim().slice(0, 280) || normKey,
      image_url: u,
      source: String(source || 'resolver').slice(0, 64),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'norm_key' }
  );
  if (error) {
    console.warn('[quote-image-cache]', error.message);
    return false;
  }
  return true;
}

async function fetchOpenFoodFactsByName(name) {
  const terms = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (terms.length < 2) return null;

  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', terms);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '8');
  url.searchParams.set(
    'fields',
    'product_name,product_name_pt,image_front_small_url,image_front_url,image_url'
  );

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': OFF_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const products = Array.isArray(data?.products) ? data.products : [];
    for (const p of products) {
      const img =
        p?.image_front_small_url || p?.image_front_url || p?.image_url || null;
      if (img && isValidImageUrl(img)) return String(img).trim();
    }
  } catch (err) {
    console.warn('[quote-off]', err?.message || err);
  }
  return null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} productName
 * @returns {Promise<{ url: string|null, source: string|null }>}
 */
export async function resolveQuoteProductImage(supabase, productName) {
  const name = String(productName || '').trim();
  if (name.length < 2) return { url: null, source: null };

  const cached = await getCached(supabase, name);
  if (cached?.url) return { url: cached.url, source: 'cache' };

  const offUrl = await fetchOpenFoodFactsByName(name);
  if (offUrl) {
    await upsertCache(supabase, name, offUrl, 'openfoodfacts');
    return { url: offUrl, source: 'openfoodfacts' };
  }

  try {
    const cosmos = await resolveCosmosProductImage({ name });
    const cosmosUrl = cosmos?.imageUrl || cosmos?.image_url || null;
    if (cosmosUrl && isValidImageUrl(cosmosUrl)) {
      const u = String(cosmosUrl).trim();
      await upsertCache(supabase, name, u, cosmos.source || 'cosmos');
      return { url: u, source: cosmos.source || 'cosmos' };
    }
  } catch (err) {
    if (!isCosmosConsumerUnavailableError(err)) {
      console.warn('[quote-cosmos]', err?.message || err);
    }
  }

  return { url: null, source: null };
}

/**
 * Resolve imagens em paralelo (com limite leve).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} names
 */
export async function resolveQuoteProductImagesBatch(supabase, names) {
  const unique = Array.from(
    new Set((names || []).map((n) => String(n || '').trim()).filter((n) => n.length >= 2))
  ).slice(0, 24);

  const out = new Map();
  const concurrency = 4;
  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (name) => {
        const r = await resolveQuoteProductImage(supabase, name);
        return [name, r];
      })
    );
    for (const [name, r] of results) out.set(name, r);
  }
  return out;
}

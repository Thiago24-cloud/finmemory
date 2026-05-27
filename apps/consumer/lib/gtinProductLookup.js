/**
 * Lookup de produto por GTIN/EAN: Supabase → Open Food Facts → Cosmos Bluesoft.
 * Cache em memória (por instância) 24h para limitar chamadas externas.
 */

import { getCosmosToken } from './cosmos';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** @type {Map<string, { data: object | null, expiresAt: number }>} */
const memoryCache = new Map();

function cacheGet(gtin) {
  const row = memoryCache.get(gtin);
  if (!row) return undefined;
  if (Date.now() > row.expiresAt) {
    memoryCache.delete(gtin);
    return undefined;
  }
  return row.data;
}

function cacheSet(gtin, data) {
  memoryCache.set(gtin, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function hasNonEmptyName(obj) {
  const n = obj?.name;
  return typeof n === 'string' && n.trim().length > 0;
}

/**
 * @param {string} gtin
 * @returns {Promise<{ name: string, brands: string | null, imageUrl: string | null } | null>}
 */
export async function fetchOpenFoodFactsByGtin(gtin) {
  const offUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(gtin)}.json?fields=product_name,product_name_pt,brands,image_front_small_url,image_url`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12000);
  try {
    const offRes = await fetch(offUrl, {
      headers: { 'User-Agent': 'FinMemory/1.0 (barcode-lookup)' },
      signal: ac.signal
    });
    if (!offRes.ok) return null;
    const offJson = await offRes.json();
    if (offJson?.status !== 1 || !offJson.product) return null;
    const p = offJson.product;
    const name = (p.product_name_pt || p.product_name || '').trim() || null;
    return {
      name,
      brands: p.brands ? String(p.brands).trim() || null : null,
      imageUrl: p.image_front_small_url || p.image_url || null
    };
  } catch (e) {
    console.warn('gtinProductLookup OFF:', e?.message || e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * @param {string} gtin
 * @returns {Promise<{ name: string, brands: string | null, imageUrl: string | null } | null>}
 */
export async function fetchCosmosBluesoftByGtin(gtin) {
  const token = getCosmosToken();
  if (!token) return null;

  const url = `https://api.cosmos.bluesoft.com.br/gtins/${encodeURIComponent(gtin)}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: {
        'X-Cosmos-Token': token,
        'Content-Type': 'application/json',
        'User-Agent': 'FinMemory App'
      },
      signal: ac.signal
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn('gtinProductLookup Cosmos HTTP', res.status);
      return null;
    }
    const j = await res.json();
    const name = j.description != null ? String(j.description).trim() : '';
    if (!name) return null;
    const brandName = j.brand?.name != null ? String(j.brand.name).trim() : '';
    const thumb = j.thumbnail != null ? String(j.thumbnail).trim() : '';
    return {
      name,
      brands: brandName || null,
      imageUrl: thumb || null
    };
  } catch (e) {
    console.warn('gtinProductLookup Cosmos:', e?.message || e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {string} gtin
 * @returns {Promise<{ name: string, brands: string | null, imageUrl: string | null, source: string } | null>}
 */
async function loadFromSupabase(supabase, gtin) {
  if (!supabase) return null;
  try {
    const { data: row, error } = await supabase
      .from('products')
      .select('name, brand, thumbnail_url, source')
      .eq('gtin', gtin)
      .maybeSingle();
    if (error || !row) return null;
    const name = row.name != null ? String(row.name).trim() : '';
    if (!name) return null;
    const src = row.source;
    const source = ['off', 'cosmos', 'user'].includes(src) ? src : 'off';
    return {
      name,
      brands: row.brand != null ? String(row.brand).trim() || null : null,
      imageUrl: row.thumbnail_url != null ? String(row.thumbnail_url).trim() || null : null,
      source
    };
  } catch (e) {
    console.warn('gtinProductLookup Supabase read:', e?.message || e);
    return null;
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {string} gtin
 * @param {{ name: string, brands: string | null, imageUrl: string | null, source: 'off' | 'cosmos' }} payload
 */
async function saveToSupabase(supabase, gtin, payload) {
  if (!supabase || !payload?.name) return;
  try {
    const { data: existing } = await supabase
      .from('products')
      .select('id, source')
      .eq('gtin', gtin)
      .maybeSingle();
    if (existing?.source === 'user') return;

    const row = {
      gtin,
      name: payload.name.trim(),
      brand: payload.brands || null,
      thumbnail_url: payload.imageUrl || null,
      source: payload.source,
      updated_at: new Date().toISOString()
    };

    if (existing?.id) {
      const { error } = await supabase.from('products').update(row).eq('id', existing.id);
      if (error) console.warn('gtinProductLookup update:', error.message);
      return;
    }

    const { error: insErr } = await supabase.from('products').insert(row);
    if (insErr) {
      if (insErr.code === '23505') {
        const { error: upErr } = await supabase.from('products').update(row).eq('gtin', gtin);
        if (upErr) console.warn('gtinProductLookup insert race:', upErr.message);
      } else {
        console.warn('gtinProductLookup insert:', insErr.message);
      }
    }
  } catch (e) {
    console.warn('gtinProductLookup Supabase save:', e?.message || e);
  }
}

/**
 * Ordem: cache → Supabase → OFF → Cosmos; persiste OFF/Cosmos no Supabase.
 * @param {string} gtin normalizado (só dígitos)
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} opts
 * @returns {Promise<{ name: string, brands: string | null, imageUrl: string | null, source?: string } | null>}
 */
export async function lookupProductByGtin(gtin, { supabase } = {}) {
  const cached = cacheGet(gtin);
  if (cached !== undefined) return cached;

  const fromDb = await loadFromSupabase(supabase, gtin);
  if (fromDb) {
    cacheSet(gtin, fromDb);
    return fromDb;
  }

  let off = await fetchOpenFoodFactsByGtin(gtin);
  if (hasNonEmptyName(off)) {
    const merged = {
      name: off.name.trim(),
      brands: off.brands,
      imageUrl: off.imageUrl,
      source: 'off'
    };
    await saveToSupabase(supabase, gtin, merged);
    cacheSet(gtin, merged);
    return merged;
  }

  const cosmos = await fetchCosmosBluesoftByGtin(gtin);
  if (hasNonEmptyName(cosmos)) {
    const merged = {
      name: cosmos.name.trim(),
      brands: cosmos.brands,
      imageUrl: cosmos.imageUrl,
      source: 'cosmos'
    };
    await saveToSupabase(supabase, gtin, merged);
    cacheSet(gtin, merged);
    return merged;
  }

  cacheSet(gtin, null);
  return null;
}

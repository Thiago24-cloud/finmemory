import { getPublicProductImageUrl } from './productImageUrl';
import { getCachedImageUrlFromDb } from './mapProductImageCache';

/** Remove wildcards do ILIKE e limita tamanho. */
function sanitizeIlikeFragment(raw) {
  return String(raw || '')
    .trim()
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

/**
 * Cruza o texto livre com `products` e miniaturas (catálogo → cache do mapa).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} typedName
 * @returns {Promise<{ catalog_product_id: string | null, list_thumbnail_url: string | null }>}
 */
export async function matchShoppingListProductFromCatalog(supabase, typedName) {
  const q = sanitizeIlikeFragment(typedName);
  if (!q || q.length < 2) {
    return { catalog_product_id: null, list_thumbnail_url: null };
  }

  const pattern = `%${q}%`;
  const { data: candidates, error } = await supabase
    .from('products')
    .select('id, name, thumbnail_url')
    .ilike('name', pattern)
    .limit(20);

  if (error || !candidates?.length) {
    const cacheOnly = await getCachedImageUrlFromDb(supabase, q);
    return { catalog_product_id: null, list_thumbnail_url: cacheOnly };
  }

  const lowerQ = q.toLowerCase();
  const scored = candidates.map((p) => {
    const name = String(p.name || '').trim();
    const nl = name.toLowerCase();
    let score = 0;
    if (nl === lowerQ) score = 100;
    else if (nl.startsWith(lowerQ)) score = 80;
    else if (nl.includes(lowerQ)) score = 55;
    else score = 30;
    if (name.length > q.length * 3) score -= 8;
    return { ...p, _name: name, _score: score };
  });
  scored.sort((a, b) => b._score - a._score || a._name.length - b._name.length);
  const best = scored[0];
  const catalog_product_id = best?.id ? String(best.id) : null;

  let list_thumbnail_url = null;
  const thumb = best?.thumbnail_url != null ? String(best.thumbnail_url).trim() : '';
  if (thumb && /^https?:\/\//i.test(thumb)) {
    list_thumbnail_url = thumb;
  }

  if (!list_thumbnail_url && catalog_product_id) {
    const { data: img } = await supabase
      .from('product_images')
      .select('storage_path')
      .eq('product_id', catalog_product_id)
      .eq('is_primary', true)
      .maybeSingle();
    if (img?.storage_path) {
      list_thumbnail_url = getPublicProductImageUrl(img.storage_path);
    }
  }

  if (!list_thumbnail_url) {
    list_thumbnail_url = await getCachedImageUrlFromDb(supabase, q);
  }

  return { catalog_product_id, list_thumbnail_url: list_thumbnail_url || null };
}

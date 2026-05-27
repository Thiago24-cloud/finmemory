/**
 * URL pública do bucket Supabase `product-images` (Storage).
 * storagePath: caminho dentro do bucket, ex. `7891234567890/front.webp` (sem barra inicial).
 */
export const PRODUCT_IMAGES_BUCKET = 'product-images';

export function getPublicProductImageUrl(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const path = storagePath.replace(/^\/+/, '');
  if (!path) return null;
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${path}`;
}

/**
 * Open Food Facts (OFF) image URL from GTIN/EAN.
 * OFF stores barcodes in chunks of 3 digits in path, e.g. 7891234567890 -> 789/123/456/7890
 */
export function getOpenFoodFactsImageUrl(gtin) {
  if (!gtin) return null;
  const digits = String(gtin).replace(/\D/g, '');
  if (digits.length < 8) return null;
  const parts = [];
  for (let i = 0; i < digits.length; i += 3) {
    parts.push(digits.slice(i, i + 3));
  }
  const path = parts.join('/');
  return `https://images.openfoodfacts.org/images/products/${path}/front_pt.400.jpg`;
}

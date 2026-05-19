/**
 * Chave R2 para foto de produto do lojista (multitenancy por loja).
 * @param {string} lojaId
 * @param {string} [productId] — se omitido, usa timestamp
 * @param {string} [ext]
 */
export function buildMerchantProductImageR2Key(lojaId, productId, ext = 'jpg') {
  const safeExt = String(ext || 'jpg').replace(/^\./, '').toLowerCase() || 'jpg';
  const id = productId || `${Date.now()}`;
  return `merchant-products/${lojaId}/${id}.${safeExt}`;
}

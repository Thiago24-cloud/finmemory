/**
 * URLs canónicas de imagem de produto no R2 (repositório FinMemory).
 */
export function getCatalogR2PublicBase() {
  return String(
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ||
      process.env.CLOUDFLARE_R2_PUBLIC_URL ||
      ''
  )
    .trim()
    .replace(/\/+$/, '');
}

/** @param {string | null | undefined} url */
export function isCatalogR2PublicUrl(url) {
  const base = getCatalogR2PublicBase();
  const u = String(url || '').trim();
  if (!base || !u) return false;
  return u.startsWith(`${base}/catalog-products/`) || u.includes('/catalog-products/');
}

/**
 * Nome utilizável para Cosmos/cache (ignora lixo de scraper: preço + loja + hash).
 * @param {string | null | undefined} name
 */
export function isLikelyEnrichableProductName(name) {
  const n = String(name || '').trim();
  if (n.length < 4) return false;
  if (/^\d+\s*%\s*off$/i.test(n)) return false;
  if (/^por$/i.test(n)) return false;
  if (/^r\$\s*[\d.,]+/i.test(n)) return false;
  if (/^[\d.,]+\s*·/i.test(n)) return false;
  if (/#\s*[a-f0-9]{6,}\b/i.test(n)) return false;
  if (/^(carrefour|assai|atacadao|dia|sonda|mambo)\b/i.test(n) && n.length < 40) return false;
  const letters = (n.match(/[a-záàâãéêíóôõúç]/gi) || []).length;
  return letters >= 3;
}

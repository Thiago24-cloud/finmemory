/**
 * Detecta URLs de miniatura inúteis (placeholder, ícone, pixel) para forçar nova busca.
 */

const BAD_URL_RE =
  /placeholder|no[-_]?image|sem[-_]?imagem|default[-_]?product|1x1|pixel\.gif|spacer|transparent\.(gif|png)|\/icons?\//i;

const TINY_DIMENSION_RE = /[?&](w|width|h|height)=(\d+)/gi;

/** Miniaturas do site da rede costumam ser fundo escuro / produto minúsculo no card. */
const SCRAPER_SITE_IMAGE_HOST_RE =
  /sondadelivery\.com\.br|atacadao\.com\.br\/.*\/(img|image|produto)/i;

/** @param {string | null | undefined} url */
export function isScraperSiteProductImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  try {
    return SCRAPER_SITE_IMAGE_HOST_RE.test(u) || SCRAPER_SITE_IMAGE_HOST_RE.test(new URL(u).hostname);
  } catch {
    return SCRAPER_SITE_IMAGE_HOST_RE.test(u);
  }
}

/** @param {string | null | undefined} url */
export function isLowQualityProductImageUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const u = url.trim();
  if (!u || u === 'undefined' || u === 'null') return true;
  if (/^data:image\/svg/i.test(u)) return true;
  if (BAD_URL_RE.test(u)) return true;

  let maxDim = 0;
  for (const m of u.matchAll(TINY_DIMENSION_RE)) {
    const n = Number.parseInt(m[2], 10);
    if (Number.isFinite(n)) maxDim = Math.max(maxDim, n);
  }
  if (maxDim > 0 && maxDim < 80) return true;

  return false;
}

/** Combina com needsThumbnailEnrichment de enrichMapPointImages. */
export function needsBetterMapProductImage(url) {
  return isLowQualityProductImageUrl(url) || isScraperSiteProductImageUrl(url);
}

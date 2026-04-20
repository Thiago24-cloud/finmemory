/**
 * JSON do mapa: miniaturas só como https:// — nunca data: (pesado/incompleto no browser).
 */

export function httpsPromoImageUrlForMapJson(url) {
  if (url == null) return null;
  const t = String(url).trim();
  if (!t) return null;
  if (/^data:/i.test(t)) return null;
  if (!/^https:\/\//i.test(t)) return null;
  return t;
}

/** Muta linhas com promo_image_url antes de devolver JSON ao mapa. */
export function sanitizeMapPointsPromoImagesHttpsOnly(rows) {
  if (!Array.isArray(rows)) return;
  for (const p of rows) {
    if (p && Object.prototype.hasOwnProperty.call(p, 'promo_image_url')) {
      p.promo_image_url = httpsPromoImageUrlForMapJson(p.promo_image_url);
    }
  }
}

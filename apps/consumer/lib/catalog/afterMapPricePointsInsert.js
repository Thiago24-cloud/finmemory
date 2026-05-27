import { triggerImageEnrichmentAsync } from './triggerImageEnrichment.js';
import { isCatalogR2PublicUrl } from './catalogImageUrls.js';

/**
 * Após inserir pontos no mapa: enriquece imagens em background (Cosmos → R2 → cache).
 * Não bloqueia scrapers nem aprovação da fila.
 *
 * @param {{ rows?: Array<{ product_name?: string, image_url?: string | null }>, storeName?: string, source?: string }} ctx
 */
export function afterMapPricePointsInsert(ctx = {}) {
  const rows = Array.isArray(ctx.rows) ? ctx.rows : [];
  const needsImage = rows.filter((r) => {
    const u = String(r?.image_url || '').trim();
    return !u || !isCatalogR2PublicUrl(u);
  });
  if (!needsImage.length) return;

  triggerImageEnrichmentAsync({
    mode: 'price_points',
    storeName: ctx.storeName || undefined,
    source: ctx.source || undefined,
    limit: Math.min(150, needsImage.length + 30),
    days: 3,
  });
}

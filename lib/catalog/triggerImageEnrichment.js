import { stripeAppBaseUrl } from '../stripe/appBaseUrl.js';

/**
 * Dispara enriquecimento de imagens em background (não bloqueia o caller).
 * @param {{ filaId?: string, mode?: 'bot_fila' | 'promocoes' | 'price_points', limit?: number, days?: number, storeName?: string, source?: string }} payload
 */
export function triggerImageEnrichmentAsync(payload = {}) {
  const base = stripeAppBaseUrl();
  const secret =
    process.env.CATALOG_ENRICH_SECRET ||
    process.env.CRON_SECRET ||
    process.env.DIA_IMPORT_SECRET;
  if (!base || !secret) {
    console.warn('[triggerImageEnrichment] URL ou secret em falta — ignorado');
    return;
  }

  const url = `${base.replace(/\/$/, '')}/api/catalog/enrich-product-images`;
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': secret,
    },
    body: JSON.stringify({ ...payload, async: true }),
  }).catch((e) => {
    console.warn('[triggerImageEnrichment]', e?.message || e);
  });
}

/**
 * Preenche URLs de miniatura para pontos do mapa quando o banco não tem imagem exibível.
 * Usa Open Food Facts por nome do produto; opcionalmente Google CSE (env).
 * Cache em memória por instância do Node reduz chamadas repetidas.
 */
import { fetchOpenFoodFactsImageByName, fetchGoogleCseImageByName } from './externalProductImages';

const CACHE = new Map();
const CACHE_MAX = 500;

function normName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

/** True quando não há URL ou quando aponta para PDF/encarte (o card precisa de foto de produto). */
export function needsThumbnailEnrichment(url) {
  if (!url || typeof url !== 'string') return true;
  const u = url.trim().toLowerCase();
  if (u.includes('.pdf') || /[?&]format=pdf\b/.test(u)) return true;
  return /\/encarte\/|encarte\.|tablo[ií]de|folheto|ofertas\/pdf|\/folheto\//i.test(u);
}

async function resolveImageUrl(productName, storeName, useCse) {
  const key = normName(productName);
  if (!key) return null;
  if (CACHE.has(key)) {
    const c = CACHE.get(key);
    return c || null;
  }

  let url = await fetchOpenFoodFactsImageByName(productName);
  if (!url && useCse) {
    url = await fetchGoogleCseImageByName(productName, storeName || '');
  }

  if (CACHE.size >= CACHE_MAX) {
    const first = CACHE.keys().next().value;
    CACHE.delete(first);
  }
  CACHE.set(key, url || null);
  return url || null;
}

/**
 * @param {Array<{ product_name: string, store_name?: string, promo_image_url?: string|null }>} points
 * @param {{ maxUniqueNames?: number, concurrency?: number, useGoogleCse?: boolean }} opts
 */
export async function enrichMapPointsImageUrls(points, opts = {}) {
  if (!Array.isArray(points) || points.length === 0) return;

  const maxUnique = Math.max(0, Number(opts.maxUniqueNames ?? 18) || 18);
  const concurrency = Math.max(1, Math.min(6, Number(opts.concurrency ?? 4) || 4));
  const useCse = Boolean(opts.useGoogleCse);

  const need = [];
  const seen = new Set();
  for (const p of points) {
    if (!needsThumbnailEnrichment(p.promo_image_url)) continue;
    const key = normName(p.product_name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    need.push({
      key,
      product_name: p.product_name,
      store_name: p.store_name || '',
    });
    if (need.length >= maxUnique) break;
  }
  if (need.length === 0) return;

  const urlByKey = new Map();
  let next = 0;

  async function worker() {
    for (;;) {
      const ix = next++;
      if (ix >= need.length) return;
      const item = need[ix];
      const url = await resolveImageUrl(item.product_name, item.store_name, useCse);
      if (url) urlByKey.set(item.key, url);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, need.length) }, () => worker()));

  for (const p of points) {
    if (!needsThumbnailEnrichment(p.promo_image_url)) continue;
    const key = normName(p.product_name);
    let u = urlByKey.get(key);
    if (!u && CACHE.has(key)) u = CACHE.get(key);
    if (u) p.promo_image_url = u;
  }
}

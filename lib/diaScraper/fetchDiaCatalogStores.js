export const DIA_LOJAS_PAGE_DATA_URL = 'https://www.dia.com.br/page-data/lojas/page-data.json';

const DIA_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let cache = /** @type {{ at: number, stores: object[] } | null} */ (null);
const CACHE_MS = 6 * 60 * 60 * 1000;

function slugToId(slug) {
  return String(slug || '')
    .replace(/\/+$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
}

/**
 * @param {object} node
 */
export function mapDiaNodeToScraperStore(node) {
  const slug = String(node?.slug || '').trim().replace(/\/+$/, '');
  const lat = parseFloat(String(node?.lat ?? '').replace(',', '.'));
  const lng = parseFloat(String(node?.lng ?? '').replace(',', '.'));
  const city = String(node?.city || 'São Paulo').trim();
  const name = String(node?.name || slug).trim();
  const address = String(node?.address || '').trim();
  const district = String(node?.district || '').trim();
  const uf = String(node?.uf || node?.state || 'SP').trim();

  const addressParts = [address, district, city, uf].filter(Boolean);
  return {
    id: slugToId(slug),
    storeUrl: `https://www.dia.com.br/lojas/${slug}/`,
    storeName: `DIA — ${city} (${name}${address ? `, ${address}` : ''})`,
    addressForGeocode: `${addressParts.join(', ')}, Brasil`,
    city,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    cep: String(node?.cep || '').replace(/\D/g, '') || null,
  };
}

/**
 * Todas as lojas DIA em SP (site oficial Gatsby page-data).
 * @returns {Promise<object[]>}
 */
export async function fetchDiaScraperStoresFromOfficial() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.stores;

  const res = await fetch(DIA_LOJAS_PAGE_DATA_URL, {
    headers: { 'User-Agent': DIA_UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`DIA lojas page-data HTTP ${res.status}`);

  const json = await res.json();
  const nodes = json?.result?.data?.lojas?.nodes || [];
  const stores = nodes
    .filter((n) => {
      const slug = String(n?.slug || '');
      const uf = String(n?.uf || n?.state || '').toUpperCase();
      return n?.status !== false && (slug.startsWith('sp-') || uf === 'SP');
    })
    .map(mapDiaNodeToScraperStore)
    .filter((s) => s.id && s.storeUrl);

  stores.sort((a, b) => a.city.localeCompare(b.city, 'pt-BR') || a.storeName.localeCompare(b.storeName, 'pt-BR'));

  cache = { at: Date.now(), stores };
  return stores;
}

/**
 * Lote rotativo para caber no timeout do cron (todas as lojas ao longo das semanas).
 * @param {object[]} allStores
 * @param {{ batchSize?: number, batchIndex?: number }} [options]
 */
export function pickScraperStoreBatch(allStores, options = {}) {
  const list = Array.isArray(allStores) ? allStores : [];
  if (!list.length) return [];

  const batchSize = Math.max(1, Math.min(Number(options.batchSize) || 15, 40));
  if (options.batchIndex != null && Number.isFinite(Number(options.batchIndex))) {
    const idx = Math.max(0, Number(options.batchIndex));
    const start = (idx * batchSize) % list.length;
    const out = [];
    for (let i = 0; i < batchSize && out.length < batchSize; i += 1) {
      out.push(list[(start + i) % list.length]);
    }
    return out;
  }

  const totalBatches = Math.max(1, Math.ceil(list.length / batchSize));
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const batchIndex = weekIndex % totalBatches;
  const start = batchIndex * batchSize;
  return list.slice(start, start + batchSize);
}

/**
 * Resolve lista final: ids pedidos, lote, ou catálogo completo.
 * @param {{ storeIds?: string[], all?: boolean, batchSize?: number, batchIndex?: number }} [opts]
 */
export async function resolveDiaScraperStores(opts = {}) {
  const all = await fetchDiaScraperStoresFromOfficial();
  const requestedIds = Array.isArray(opts.storeIds) ? opts.storeIds.map(String) : null;

  if (requestedIds?.length) {
    const picked = all.filter((s) => requestedIds.includes(s.id));
    return { stores: picked, catalogTotal: all.length, mode: 'storeIds' };
  }

  if (opts.all === true) {
    return { stores: all, catalogTotal: all.length, mode: 'all' };
  }

  const batchSize = Number(opts.batchSize || process.env.SCRAPER_DIA_BATCH_SIZE || 15);
  const stores = pickScraperStoreBatch(all, {
    batchSize,
    batchIndex: opts.batchIndex,
  });
  return { stores, catalogTotal: all.length, mode: 'batch', batchSize };
}

/** Fallback estático (dev/teste offline) — preferir fetch oficial. */
export { DIA_SCRAPER_STORES } from './storesCatalog.js';

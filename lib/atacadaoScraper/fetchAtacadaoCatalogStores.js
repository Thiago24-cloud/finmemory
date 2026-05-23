import { pickScraperStoreBatch } from '../diaScraper/fetchDiaCatalogStores.js';

/**
 * CEPs âncora em SP para descobrir filiais Atacadão via VTEX regions API.
 * Filtra UF=SP via ViaCEP.
 */
const SP_SEED_CEPS = [
  '01001000', '01310100', '02050000', '03047000', '04038002', '05001000',
  '05508000', '06010000', '06268000', '06460030', '06602000', '06683000',
  '07010000', '07110000', '08010000', '08260000', '08730000', '09010000',
  '09110000', '09210000', '09350000', '09510000', '09810000', '09891001',
  '11010000', '11740000', '12010000', '12210000', '12245000', '12410000',
  '12910000', '13010000', '13270000', '13480000', '14010000', '14810000',
  '15010000', '17010000', '18010000', '19010000', '02170901', '04661300',
  '04209000', '04905020', '03453100', '02938000', '06327290', '08543000',
  '18130000', '08564000', '07750000', '13201000', '13330000', '13465000',
  '13670000', '13840000', '13970000', '14160000', '14400000', '14500000',
  '14870000', '15990000', '16200000', '17200000', '17500000', '18540000',
  '19900000',
];

const ATACADAO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let cache = /** @type {{ at: number, stores: object[] } | null} */ (null);
const CACHE_MS = 12 * 60 * 60 * 1000;

/** @param {string} cep */
async function fetchViaCep(cep) {
  const digits = String(cep).replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      headers: { 'User-Agent': ATACADAO_UA },
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (j?.erro) return null;
    return j;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<Map<string, { sellerId: string, name: string, cep: string, city: string, uf: string }>>}
 */
async function discoverAtacadaoSellersSp() {
  const map = new Map();

  for (const cep of SP_SEED_CEPS) {
  // eslint-disable-next-line no-await-in-loop
    const via = await fetchViaCep(cep);
    if (!via || String(via.uf || '').toUpperCase() !== 'SP') continue;

  // eslint-disable-next-line no-await-in-loop
    const res = await fetch(
      `https://www.atacadao.com.br/api/checkout/pub/regions?country=BRA&postalCode=${cep}`,
      { headers: { 'User-Agent': ATACADAO_UA, Accept: 'application/json' } }
    );
    if (!res.ok) continue;

  // eslint-disable-next-line no-await-in-loop
    const regions = await res.json();
    for (const region of regions || []) {
      for (const seller of region.sellers || []) {
        const sellerId = String(seller?.id || '').trim();
        const name = String(seller?.name || '').trim();
        if (!sellerId || !name) continue;
        if (!map.has(sellerId)) {
          map.set(sellerId, {
            sellerId,
            name,
            cep,
            city: String(via.localidade || '').trim(),
            uf: 'SP',
          });
        }
      }
    }

  // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 120));
  }

  return map;
}

/**
 * @param {{ sellerId: string, name: string, cep: string, city: string }} row
 */
function mapAtacadaoRowToScraperStore(row) {
  const id = String(row.sellerId || '')
    .replace(/^atacadaobr/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const city = row.city || 'São Paulo';
  return {
    id: id || row.sellerId,
    sellerId: row.sellerId,
    cep: String(row.cep || '').replace(/\D/g, ''),
    cnpj: null,
    storeName: `Atacadão — ${row.name}${city ? ` (${city})` : ''}`,
    addressForGeocode: `Atacadão ${row.name}, ${city}, SP, Brasil`,
    city,
  };
}

/**
 * Filiais Atacadão em SP (descoberta via VTEX + ViaCEP).
 * @returns {Promise<object[]>}
 */
export async function fetchAtacadaoScraperStoresFromOfficial() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.stores;

  const discovered = await discoverAtacadaoSellersSp();
  const stores = [...discovered.values()]
    .map(mapAtacadaoRowToScraperStore)
    .filter((s) => s.cep?.length === 8);

  const { ATACADAO_SCRAPER_STORES } = await import('./storesCatalog.js');
  const cnpjById = new Map(ATACADAO_SCRAPER_STORES.map((s) => [s.id, s.cnpj]));
  for (const s of stores) {
    if (cnpjById.has(s.id)) s.cnpj = cnpjById.get(s.id);
  }

  stores.sort((a, b) => a.city.localeCompare(b.city, 'pt-BR') || a.storeName.localeCompare(b.storeName, 'pt-BR'));

  cache = { at: Date.now(), stores };
  return stores;
}

/**
 * @param {{ storeIds?: string[], all?: boolean, batchSize?: number, batchIndex?: number }} [opts]
 */
export async function resolveAtacadaoScraperStores(opts = {}) {
  const all = await fetchAtacadaoScraperStoresFromOfficial();
  const requestedIds = Array.isArray(opts.storeIds) ? opts.storeIds.map(String) : null;

  if (requestedIds?.length) {
    return {
      stores: all.filter((s) => requestedIds.includes(s.id) || requestedIds.includes(s.sellerId)),
      catalogTotal: all.length,
      mode: 'storeIds',
    };
  }

  if (opts.all === true) {
    return { stores: all, catalogTotal: all.length, mode: 'all' };
  }

  const batchSize = Number(opts.batchSize || process.env.SCRAPER_ATACADAO_BATCH_SIZE || 12);
  const stores = pickScraperStoreBatch(all, {
    batchSize,
    batchIndex: opts.batchIndex,
  });
  return { stores, catalogTotal: all.length, mode: 'batch', batchSize };
}

export { ATACADAO_SCRAPER_STORES } from './storesCatalog.js';

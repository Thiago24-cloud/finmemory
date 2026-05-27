/**
 * Persistência IndexedDB para cache de ofertas por loja (encartes grandes).
 */

const DB_NAME = 'finmemory_map_store_offers';
const DB_VERSION = 1;
const STORE_NAME = 'by_store';

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null;

function supportsIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function openDb() {
  if (!supportsIndexedDb()) {
    return Promise.reject(new Error('IndexedDB indisponível'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'storeId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Falha ao abrir IndexedDB'));
    });
  }
  return dbPromise;
}

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

/**
 * @param {string} storeId
 * @returns {Promise<{ cachedAt: string, expiresAt: string, data: object } | null>}
 */
export async function idbReadStoreOffersEntry(storeId) {
  if (!storeId) return null;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const row = await idbRequest(tx.objectStore(STORE_NAME).get(String(storeId).trim()));
  if (!row?.data || !Array.isArray(row.data.offers)) return null;
  if (!Array.isArray(row.data.promotions)) row.data.promotions = [];
  return {
    cachedAt: row.cachedAt,
    expiresAt: row.expiresAt,
    data: row.data,
  };
}

/**
 * @param {string} storeId
 * @param {{ cachedAt: string, expiresAt: string, data: object }} entry
 */
export async function idbWriteStoreOffersEntry(storeId, entry) {
  if (!storeId || !entry) return;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await idbRequest(
    tx.objectStore(STORE_NAME).put({
      storeId: String(storeId).trim(),
      cachedAt: entry.cachedAt,
      expiresAt: entry.expiresAt,
      data: entry.data,
    })
  );
}

/** @param {string} storeId */
export async function idbDeleteStoreOffersEntry(storeId) {
  if (!storeId) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await idbRequest(tx.objectStore(STORE_NAME).delete(String(storeId).trim()));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} keepStoreId
 * @param {number} maxEntries
 */
export async function idbPruneStoreOffersEntries(keepStoreId, maxEntries) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const all = await idbRequest(store.getAll());
  if (!Array.isArray(all) || all.length <= maxEntries) return;
  const keep = String(keepStoreId).trim();
  const sorted = [...all].sort((a, b) => {
    const ta = a?.cachedAt ? Date.parse(a.cachedAt) : 0;
    const tb = b?.cachedAt ? Date.parse(b.cachedAt) : 0;
    return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
  });
  let count = all.length;
  for (const row of sorted) {
    if (count <= maxEntries) break;
    if (row.storeId === keep) continue;
    await idbRequest(store.delete(row.storeId));
    count -= 1;
  }
}

/** @returns {Promise<string[]>} */
export async function idbAllStoreOfferIds() {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const all = await idbRequest(tx.objectStore(STORE_NAME).getAll());
  return Array.isArray(all) ? all.map((r) => r.storeId).filter(Boolean) : [];
}

export function isIndexedDbAvailable() {
  return supportsIndexedDb();
}

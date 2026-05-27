/**
 * Cache local por estabelecimento (ofertas do painel /api/map/store-offers).
 * IndexedDB (principal) + localStorage (fallback e migração v1).
 */

import { computeStoreOffersCacheExpiresAt } from './mapStoreOffersCacheExpires';
import {
  idbReadStoreOffersEntry,
  idbWriteStoreOffersEntry,
  idbDeleteStoreOffersEntry,
  idbPruneStoreOffersEntries,
  isIndexedDbAvailable,
} from './mapStoreOffersCacheDb';

const STORAGE_PREFIX = 'finmemory_map_store_offers_v1:';
const MAX_ENTRIES = 48;

let migrateDone = false;

/** @typedef {'fresh-cache' | 'stale-offline' | 'network'} StoreOffersCacheSource */

/**
 * @typedef {Object} StoreOffersCachePayload
 * @property {Record<string, unknown> | null} [store]
 * @property {unknown[]} offers
 * @property {unknown[]} promotions
 */

/**
 * @typedef {Object} StoreOffersCacheEntry
 * @property {string} cachedAt ISO
 * @property {string} expiresAt ISO
 * @property {StoreOffersCachePayload} data
 */

/**
 * @typedef {Object} GetSupermercadoDataResult
 * @property {StoreOffersCachePayload} data
 * @property {StoreOffersCacheSource} source
 * @property {boolean} fromCache
 * @property {boolean} stale
 * @property {string} [notice]
 */

function storageKey(storeId) {
  return `${STORAGE_PREFIX}${String(storeId).trim()}`;
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeEntry(entry) {
  if (!entry?.data || !Array.isArray(entry.data.offers)) return null;
  if (!Array.isArray(entry.data.promotions)) entry.data.promotions = [];
  return entry;
}

function readLegacyLocalStorage(storeId) {
  if (typeof window === 'undefined' || !storeId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(storeId));
    if (!raw) return null;
    return normalizeEntry(safeParse(raw));
  } catch {
    return null;
  }
}

function writeLegacyLocalStorage(storeId, entry) {
  if (typeof window === 'undefined' || !storeId || !entry) return;
  try {
    window.localStorage.setItem(storageKey(storeId), JSON.stringify(entry));
    pruneLegacyLocalStorage(storeId);
  } catch {
    /* quota */
  }
}

function removeLegacyLocalStorage(storeId) {
  if (typeof window === 'undefined' || !storeId) return;
  try {
    window.localStorage.removeItem(storageKey(storeId));
  } catch {
    /* ignore */
  }
}

function pruneLegacyLocalStorage(keepStoreId) {
  if (typeof window === 'undefined') return;
  const keepKey = storageKey(keepStoreId);
  const keys = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
  }
  if (keys.length <= MAX_ENTRIES) return;
  const scored = keys
    .map((k) => {
      const entry = safeParse(window.localStorage.getItem(k));
      const t = entry?.cachedAt ? Date.parse(entry.cachedAt) : 0;
      return { k, t: Number.isFinite(t) ? t : 0 };
    })
    .sort((a, b) => a.t - b.t);
  for (const { k } of scored) {
    if (keys.length <= MAX_ENTRIES) break;
    if (k === keepKey) continue;
    try {
      window.localStorage.removeItem(k);
      const idx = keys.indexOf(k);
      if (idx >= 0) keys.splice(idx, 1);
    } catch {
      /* ignore */
    }
  }
}

/** Migra entradas antigas (localStorage) → IndexedDB, uma vez por sessão. */
async function migrateLegacyToIndexedDbOnce() {
  if (migrateDone || typeof window === 'undefined' || !isIndexedDbAvailable()) return;
  migrateDone = true;
  const keys = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
  }
  for (const k of keys) {
    const storeId = k.slice(STORAGE_PREFIX.length);
    const entry = readLegacyLocalStorage(storeId);
    if (!entry) {
      removeLegacyLocalStorage(storeId);
      continue;
    }
    try {
      await idbWriteStoreOffersEntry(storeId, entry);
      removeLegacyLocalStorage(storeId);
    } catch {
      /* mantém no localStorage se IDB falhar */
    }
  }
}

/** @returns {boolean} */
export function isStoreOffersCacheValid(entry, nowMs = Date.now()) {
  if (!entry || typeof entry !== 'object') return false;
  const exp = entry.expiresAt;
  if (!exp || typeof exp !== 'string') return false;
  const t = Date.parse(exp);
  return Number.isFinite(t) && nowMs < t;
}

/** @param {string} storeId @returns {Promise<StoreOffersCacheEntry | null>} */
export async function readStoreOffersCache(storeId) {
  if (!storeId) return null;
  await migrateLegacyToIndexedDbOnce();

  if (isIndexedDbAvailable()) {
    try {
      const fromIdb = await idbReadStoreOffersEntry(storeId);
      if (fromIdb) return fromIdb;
    } catch {
      /* fallback */
    }
  }
  return readLegacyLocalStorage(storeId);
}

/** @param {string} storeId @param {StoreOffersCacheEntry} entry */
export async function writeStoreOffersCache(storeId, entry) {
  if (!storeId || !entry) return;
  let idbOk = false;
  if (isIndexedDbAvailable()) {
    try {
      await idbWriteStoreOffersEntry(storeId, entry);
      await idbPruneStoreOffersEntries(storeId, MAX_ENTRIES);
      idbOk = true;
      removeLegacyLocalStorage(storeId);
    } catch {
      /* fallback localStorage */
    }
  }
  if (!idbOk) {
    writeLegacyLocalStorage(storeId, entry);
  }
}

/** Invalida cache da loja (ex.: após confirmar preço no mapa). */
export async function clearStoreOffersCache(storeId) {
  if (!storeId) return;
  removeLegacyLocalStorage(storeId);
  if (isIndexedDbAvailable()) {
    await idbDeleteStoreOffersEntry(storeId);
  }
}

function isLikelyOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * @param {Object} params
 * @param {string} params.storeId
 * @param {() => Promise<{ store?: object, offers: unknown[], promotions?: unknown[], expiresAt?: string }>} params.fetchFresh
 * @returns {Promise<GetSupermercadoDataResult>}
 */
export async function getSupermercadoData({ storeId, fetchFresh }) {
  if (!storeId) {
    throw new Error('storeId é obrigatório');
  }

  const cached = await readStoreOffersCache(storeId);
  const now = Date.now();

  if (cached && isStoreOffersCacheValid(cached, now)) {
    return {
      data: cached.data,
      source: 'fresh-cache',
      fromCache: true,
      stale: false,
    };
  }

  const needNetwork = !cached || !isStoreOffersCacheValid(cached, now);

  if (needNetwork && isLikelyOffline()) {
    if (cached?.data) {
      return {
        data: cached.data,
        source: 'stale-offline',
        fromCache: true,
        stale: true,
        notice: 'Dados desatualizados — sem conexão',
      };
    }
    throw new Error('Sem conexão. Conecte-se à internet para carregar as ofertas desta loja.');
  }

  try {
    const fresh = await fetchFresh();
    const offers = Array.isArray(fresh?.offers) ? fresh.offers : [];
    const promotions = Array.isArray(fresh?.promotions) ? fresh.promotions : [];
    const store = fresh?.store && typeof fresh.store === 'object' ? fresh.store : null;

    const expiresAt =
      typeof fresh?.expiresAt === 'string' && fresh.expiresAt
        ? fresh.expiresAt
        : computeStoreOffersCacheExpiresAt({ store, offers, promotions });

    const entry = {
      cachedAt: new Date().toISOString(),
      expiresAt,
      data: { store, offers, promotions },
    };
    await writeStoreOffersCache(storeId, entry);

    return {
      data: entry.data,
      source: 'network',
      fromCache: false,
      stale: false,
    };
  } catch (err) {
    if (cached?.data) {
      return {
        data: cached.data,
        source: 'stale-offline',
        fromCache: true,
        stale: true,
        notice: 'Dados desatualizados — sem conexão',
      };
    }
    throw err;
  }
}

/** Fetch padrão para GET /api/map/store-offers. */
export async function fetchStoreOffersFromApi(storeId) {
  const res = await fetch(`/api/map/store-offers?store_id=${encodeURIComponent(storeId)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Erro ao carregar ofertas');
  }
  return {
    store: body.store,
    offers: Array.isArray(body.offers) ? body.offers : [],
    promotions: Array.isArray(body.promotions) ? body.promotions : [],
    expiresAt: body.cacheExpiresAt || body.expiresAt,
  };
}

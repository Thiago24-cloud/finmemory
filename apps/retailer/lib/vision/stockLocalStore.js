const DB_NAME = 'finmemory_retailer_stock';
const DB_VERSION = 1;
const STORE = 'insumos';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('ean', 'ean', { unique: false });
        store.createIndex('nome_norm', 'nome_norm', { unique: false });
        store.createIndex('loja_id', 'loja_id', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function normName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Cache local de insumos (equivalente SQLite/WatermelonDB no web).
 * Sincronize via `syncFromApi` antes do modo visão offline.
 */
export const stockLocalStore = {
  async syncFromApi(insumos, lojaId) {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);

    await new Promise((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = resolve;
      clearReq.onerror = () => reject(clearReq.error);
    });

    for (const row of insumos || []) {
      store.put({
        ...row,
        loja_id: lojaId,
        nome_norm: normName(row.nome),
      });
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },

  async findById(id) {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const item = await new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return item;
  },

  async findByEan(ean) {
    const digits = String(ean || '').replace(/\D/g, '');
    if (!digits) return null;
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('ean');
    const item = await new Promise((resolve, reject) => {
      const req = idx.get(digits);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return item;
  },

  /** Busca por label do modelo — match exato normalizado, depois includes. */
  async findByLabel(label) {
    const needle = normName(label);
    if (!needle) return null;
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();

    const exact = all.find((i) => i.nome_norm === needle);
    if (exact) return exact;
    return all.find((i) => i.nome_norm.includes(needle) || needle.includes(i.nome_norm)) || null;
  },
};

/**
 * Cruza nomes da lista de compras com ofertas do mapa (price_points / promoções).
 */

import { isPlausiblePromoPrice, pickBestPlausibleOffer, offerNameMatchScore } from './offerPriceSanity.js';

export function normalizeProductNameForMatch(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} listName
 * @param {string} offerName
 */
export function listItemMatchesOfferName(listName, offerName) {
  return offerNameMatchScore(listName, offerName) > 0;
}

/**
 * @param {Array<{ id?: string, name: string }>} listItems
 * @param {Array<{ lugar_id: string, nome_loja: string, lat?: number, lng?: number, produto_nome: string, preco: number, origem: string, imagem_url?: string }>} rpcRows
 */
export function groupMapOffersByListItems(listItems, rpcRows) {
  const rows = Array.isArray(rpcRows) ? rpcRows : [];
  const items = (listItems || [])
    .map((it) => ({
      listItemId: it.id || null,
      listName: String(it.name || '').trim(),
    }))
    .filter((it) => it.listName.length >= 2);

  const grouped = items.map((it) => {
    const offers = rows
      .filter((row) => listItemMatchesOfferName(it.listName, row.produto_nome))
      .map((row) => ({
        lugar_id: row.lugar_id,
        nome_loja: row.nome_loja,
        produto_nome: row.produto_nome,
        preco: Number(row.preco),
        origem: row.origem,
        lat: row.lat,
        lng: row.lng,
        imagem_url: row.imagem_url || row.image_url || null,
        matchScore: offerNameMatchScore(it.listName, row.produto_nome),
      }))
      .filter((o) => Number.isFinite(o.preco) && o.preco > 0 && isPlausiblePromoPrice(o.produto_nome, o.preco))
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return a.preco - b.preco;
      });

    // Dedup por loja (mantém melhor score/preço)
    const byStore = new Map();
    for (const o of offers) {
      const k = String(o.nome_loja || '').toLowerCase();
      if (!byStore.has(k)) byStore.set(k, o);
    }
    const deduped = [...byStore.values()].sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.preco - b.preco;
    });

    const bestOffer = deduped[0] || null;
    return {
      listItemId: it.listItemId,
      listName: it.listName,
      matched: deduped.length > 0,
      offersCount: deduped.length,
      bestOffer,
      image_url: bestOffer?.imagem_url || null,
      offers: deduped.slice(0, 8),
    };
  });

  const matched = grouped.filter((g) => g.matched).length;
  const storeNames = new Set();
  for (const g of grouped) {
    for (const o of g.offers) {
      if (o.nome_loja) storeNames.add(o.nome_loja);
    }
  }

  return {
    summary: {
      total: grouped.length,
      matched,
      unmatched: grouped.length - matched,
      storesCount: storeNames.size,
    },
    items: grouped,
  };
}

export function parseListItemNames(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((s) => String(s || '').trim())
      .filter((n) => n.length >= 2)
      .slice(0, 24);
  }
  return String(raw || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((n) => n.length >= 2)
    .slice(0, 24);
}

/**
 * Total estimado da lista em cada supermercado (melhor preço por item naquela loja).
 */
export function computeStoreTotalsForList(listItemNames, rpcRows) {
  const names = parseListItemNames(listItemNames);
  const rows = Array.isArray(rpcRows) ? rpcRows : [];
  if (names.length === 0) return [];

  const byStore = new Map();
  for (const row of rows) {
    // Agrupar por nome da loja (lugar_id é único por oferta no RPC).
    const storeName = String(row.nome_loja || 'Mercado').trim() || 'Mercado';
    const storeKey = storeName.toLowerCase();
    if (!byStore.has(storeKey)) {
      byStore.set(storeKey, {
        storeId: storeKey,
        storeName,
        lat: row.lat,
        lng: row.lng,
        rows: [],
      });
    }
    byStore.get(storeKey).rows.push(row);
  }

  const stores = [];
  for (const store of byStore.values()) {
    const lines = [];
    let total = 0;
    for (const listName of names) {
      const candidates = store.rows
        .filter((row) => listItemMatchesOfferName(listName, row.produto_nome))
        .map((row) => ({
          ...row,
          preco: Number(row.preco),
          imagem_url: row.imagem_url || row.image_url || null,
        }))
        .filter((o) => Number.isFinite(o.preco) && o.preco > 0);
      const best = pickBestPlausibleOffer(listName, candidates);
      if (best) {
        lines.push({
          listName,
          productName: best.produto_nome,
          price: best.preco,
          image_url: best.imagem_url || null,
        });
        total += best.preco;
      }
    }
    if (lines.length > 0) {
      stores.push({
        storeId: store.storeId,
        storeName: store.storeName,
        lat: store.lat,
        lng: store.lng,
        coveredItems: lines.length,
        totalItems: names.length,
        coveragePct: Math.round((lines.length / names.length) * 100),
        total: Number(total.toFixed(2)),
        lines,
      });
    }
  }

  stores.sort((a, b) => {
    if (b.coveredItems !== a.coveredItems) return b.coveredItems - a.coveredItems;
    return a.total - b.total;
  });

  return stores;
}

export function compareListWithMapOffers(listItemNames, rpcRows) {
  const names = parseListItemNames(listItemNames);
  const listItems = names.map((name, i) => ({ id: `q-${i}`, name }));
  const byItem = groupMapOffersByListItems(listItems, rpcRows);
  const byStore = computeStoreTotalsForList(names, rpcRows);
  return { ...byItem, stores: byStore };
}

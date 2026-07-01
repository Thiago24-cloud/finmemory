/**
 * Cruza lista de compras do lojista com ofertas do mapa (price_points / RPC).
 * @see apps/consumer/lib/shoppingListMapMatch.js
 */

export function normalizeProductNameForMatch(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function listItemMatchesOfferName(listName, offerName) {
  const a = normalizeProductNameForMatch(listName);
  const b = normalizeProductNameForMatch(offerName);
  if (a.length < 2 || b.length < 2) return false;
  if (b.includes(a) || a.includes(b)) return true;
  const aWords = a.split(/\s+/).filter((w) => w.length >= 3);
  if (aWords.length === 0) return b.includes(a);
  return aWords.some((w) => b.includes(w));
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

export function groupMapOffersByListItems(listItems, rpcRows) {
  const rows = Array.isArray(rpcRows) ? rpcRows : [];
  const items = (listItems || [])
    .map((name, i) => ({
      listItemId: `item-${i}`,
      listName: String(name || '').trim(),
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
      }))
      .filter((o) => Number.isFinite(o.preco) && o.preco > 0)
      .sort((a, b) => a.preco - b.preco);

    const bestOffer = offers[0] || null;
    return {
      listItemId: it.listItemId,
      listName: it.listName,
      matched: offers.length > 0,
      offersCount: offers.length,
      bestOffer,
      offers: offers.slice(0, 8),
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

/**
 * Total estimado da lista em cada supermercado (melhor preço por item naquela loja).
 * @param {string[]} listItemNames
 * @param {Array} rpcRows — saída de buscar_lojas_por_produtos_lista
 */
export function computeStoreTotalsForList(listItemNames, rpcRows) {
  const names = parseListItemNames(listItemNames);
  const rows = Array.isArray(rpcRows) ? rpcRows : [];
  if (names.length === 0) return [];

  const byStore = new Map();
  for (const row of rows) {
    const storeKey = String(row.lugar_id || row.nome_loja || '').trim() || 'loja';
    if (!byStore.has(storeKey)) {
      byStore.set(storeKey, {
        storeId: row.lugar_id || null,
        storeName: String(row.nome_loja || 'Mercado').trim() || 'Mercado',
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
      const matches = store.rows
        .filter((row) => listItemMatchesOfferName(listName, row.produto_nome))
        .map((row) => ({ ...row, preco: Number(row.preco) }))
        .filter((o) => Number.isFinite(o.preco) && o.preco > 0)
        .sort((a, b) => a.preco - b.preco);
      if (matches.length > 0) {
        const best = matches[0];
        lines.push({
          listName,
          productName: best.produto_nome,
          price: best.preco,
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

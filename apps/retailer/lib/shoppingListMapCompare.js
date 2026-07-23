/**
 * Cruza lista de compras do lojista com ofertas do mapa (price_points / RPC).
 * @see apps/consumer/lib/shoppingListMapMatch.js
 */

const MATCH_STOP = new Set([
  'tipo',
  'pacote',
  'unidade',
  'un',
  'kg',
  'g',
  'ml',
  'l',
  'com',
  'sem',
  'para',
  'cada',
  'leve',
  'pague',
]);

const MEAL_NOISE = new Set([
  'frango',
  'cremoso',
  'lasanha',
  'prato',
  'pronto',
  'refeicao',
  'brocolis',
  'strogonoff',
  'risoto',
]);

export function normalizeProductNameForMatch(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantWords(norm) {
  return norm
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !MATCH_STOP.has(w) && !/^\d+$/.test(w));
}

/**
 * Score lista ↔ oferta. 0 = sem match.
 * Exige a palavra-cabeça (ex.: arroz) na oferta; evita "Frango com arroz" para "arroz".
 */
export function offerMatchScore(listName, offerName) {
  const a = normalizeProductNameForMatch(listName);
  const b = normalizeProductNameForMatch(offerName);
  if (a.length < 2 || b.length < 2) return 0;

  const aWords = significantWords(a);
  const bWords = significantWords(b);
  if (!aWords.length) return b.includes(a) ? 10 : 0;

  const head = aWords[0];
  if (!b.includes(head)) return 0;

  const listIsStaple = aWords.length <= 4 && !aWords.some((w) => MEAL_NOISE.has(w));
  if (listIsStaple && bWords.some((w) => MEAL_NOISE.has(w))) return 0;

  let score = 20;
  if (a === b) score += 100;
  else if (b.includes(a)) score += 50;
  else if (a.includes(b) && b.length >= 4) score += 30;

  for (const w of aWords) {
    if (b.includes(w)) score += 12;
  }
  if (/\b5\s*kg\b/.test(a) && /\b5\s*kg\b/.test(b)) score += 8;
  if (/\b1\s*kg\b/.test(a) && /\b1\s*kg\b/.test(b)) score += 8;
  return score;
}

export function listItemMatchesOfferName(listName, offerName) {
  return offerMatchScore(listName, offerName) > 0;
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

function pickBestOffer(listName, candidates) {
  const scored = (candidates || [])
    .map((row) => ({
      ...row,
      preco: Number(row.preco ?? row.price),
      _score: offerMatchScore(listName, row.produto_nome || row.productName || ''),
    }))
    .filter((o) => o._score > 0 && Number.isFinite(o.preco) && o.preco > 0);
  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return a.preco - b.preco;
  });
  return scored[0] || null;
}

export function groupMapOffersByListItems(listItems, rpcRows) {
  const rows = Array.isArray(rpcRows) ? rpcRows : [];
  const items = (listItems || [])
    .map((it, i) => ({
      listItemId: it?.id || `item-${i}`,
      listName: String(it?.name || it || '').trim(),
    }))
    .filter((it) => it.listName.length >= 2);

  const grouped = items.map((it) => {
    const offers = rows
      .filter((row) => {
        if (/\[sim-cesta\]/i.test(row.produto_nome || '')) return false;
        return offerMatchScore(it.listName, row.produto_nome) > 0;
      })
      .map((row) => ({
        lugar_id: row.lugar_id,
        nome_loja: row.nome_loja,
        produto_nome: row.produto_nome,
        preco: Number(row.preco),
        origem: row.origem,
        lat: row.lat,
        lng: row.lng,
        expires_at: row.expires_at || null,
        created_at: row.created_at || null,
        matchScore: offerMatchScore(it.listName, row.produto_nome),
      }))
      .filter((o) => Number.isFinite(o.preco) && o.preco > 0)
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return a.preco - b.preco;
      });

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

export function computeStoreTotalsForList(listItemNames, rpcRows) {
  const names = parseListItemNames(listItemNames);
  const rows = Array.isArray(rpcRows) ? rpcRows : [];
  if (names.length === 0) return [];

  const byStore = new Map();
  for (const row of rows) {
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
      const best = pickBestOffer(listName, store.rows);
      if (best) {
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

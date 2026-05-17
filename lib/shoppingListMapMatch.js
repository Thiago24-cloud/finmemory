/**
 * Cruza nomes da lista de compras com ofertas do mapa (price_points / promoções).
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

/**
 * @param {string} listName
 * @param {string} offerName
 */
export function listItemMatchesOfferName(listName, offerName) {
  const a = normalizeProductNameForMatch(listName);
  const b = normalizeProductNameForMatch(offerName);
  if (a.length < 2 || b.length < 2) return false;
  if (b.includes(a) || a.includes(b)) return true;

  const aWords = a.split(/\s+/).filter((w) => w.length >= 3);
  if (aWords.length === 0) return b.includes(a);
  return aWords.some((w) => b.includes(w));
}

/**
 * @param {Array<{ id?: string, name: string }>} listItems
 * @param {Array<{ lugar_id: string, nome_loja: string, lat?: number, lng?: number, produto_nome: string, preco: number, origem: string }>} rpcRows
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

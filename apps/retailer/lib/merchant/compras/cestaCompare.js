/**
 * Cesta de compras do lojista: insumos + ofertas do mapa + simulação de substituição.
 */
import {
  normalizeProductNameForMatch,
} from '../../shoppingListMapCompare';
import { insumoOfferMatches } from './insumoMatchTerms';

export function offerKey(offer) {
  if (!offer) return '';
  const lugar = String(offer.lugar_id || offer.nome_loja || '').trim();
  const nome = String(offer.produto_nome || '').trim();
  const preco = Number(offer.preco);
  return `${lugar}|${nome}|${Number.isFinite(preco) ? preco.toFixed(2) : ''}`;
}

export function normalizeMapOffer(row) {
  if (!row) return null;
  const preco = Number(row.preco);
  if (!Number.isFinite(preco) || preco <= 0) return null;
  return {
    lugar_id: row.lugar_id || null,
    nome_loja: String(row.nome_loja || 'Mercado').trim() || 'Mercado',
    produto_nome: String(row.produto_nome || '').trim(),
    preco,
    origem: row.origem || null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    matchMethod: row._matchMethod || row.matchMethod || null,
  };
}

function offerMatchesInsumo(insumo, row) {
  if (row?._insumoId && row._insumoId === insumo.id) {
    return { match: true, method: row._matchMethod || 'gtin' };
  }
  return insumoOfferMatches(insumo, row.produto_nome);
}

function offersForInsumo(insumo, rpcRows) {
  const seen = new Set();
  const offers = [];
  for (const row of rpcRows || []) {
    const { match, method } = offerMatchesInsumo(insumo, row);
    if (!match) continue;
    const o = normalizeMapOffer(row);
    if (!o) continue;
    o.matchMethod = method || row._matchMethod || null;
    const key = offerKey(o);
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push(o);
  }
  offers.sort((a, b) => a.preco - b.preco);
  return offers;
}

function pickSelectedOffer(offers, savedOffer) {
  if (!offers.length) return null;
  if (!savedOffer || typeof savedOffer !== 'object') return offers[0];
  const savedKey = offerKey(savedOffer);
  const exact = offers.find((o) => offerKey(o) === savedKey);
  if (exact) return exact;
  const savedName = normalizeProductNameForMatch(savedOffer.produto_nome);
  if (savedName) {
    const byName = offers.find(
      (o) => normalizeProductNameForMatch(o.produto_nome) === savedName
    );
    if (byName) return byName;
  }
  return offers[0];
}

function resolveCestaQuantity(insumo) {
  const custom = Number(insumo.cesta_quantidade);
  if (Number.isFinite(custom) && custom > 0) return custom;
  const min = Number(insumo.estoque_minimo);
  const atual = Number(insumo.quantidade_atual);
  if (Number.isFinite(min) && min > 0 && Number.isFinite(atual) && atual < min) {
    return Math.max(1, Math.round((min - atual) * 1000) / 1000);
  }
  return 1;
}

/**
 * @param {Array} insumos — linhas insumos_loja (API)
 * @param {Array} rpcRows
 * @param {Record<string, object>} selectionOverrides — insumoId → oferta
 */
export function buildCestaCompare(insumos, rpcRows, selectionOverrides = {}) {
  const cestaInsumos = (insumos || []).filter((i) => i.na_cesta && i.ativo !== false);
  const rows = Array.isArray(rpcRows) ? rpcRows : [];

  const items = cestaInsumos.map((insumo) => {
    const offers = offersForInsumo(insumo, rows);
    const saved =
      selectionOverrides[insumo.id] !== undefined
        ? selectionOverrides[insumo.id]
        : insumo.cesta_oferta;
    const selectedOffer = pickSelectedOffer(offers, saved);
    const quantidade = resolveCestaQuantity(insumo);
    const lineTotal =
      selectedOffer && Number.isFinite(selectedOffer.preco)
        ? Number((selectedOffer.preco * quantidade).toFixed(2))
        : null;

    return {
      insumoId: insumo.id,
      nome: insumo.nome,
      canonical_name: insumo.canonical_name || null,
      match_source: insumo.match_source || null,
      match_termos: Array.isArray(insumo.match_termos) ? insumo.match_termos : null,
      ean: insumo.ean || null,
      imagem_url: insumo.imagem_url || insumo.image_url || null,
      unidade: insumo.unidade || 'un',
      quantidade,
      quantidade_atual: insumo.quantidade_atual,
      estoque_minimo: insumo.estoque_minimo,
      abaixo_minimo: insumo.abaixo_minimo,
      matched: offers.length > 0,
      offersCount: offers.length,
      offers: offers.slice(0, 12),
      selectedOffer,
      selectedOfferKey: selectedOffer ? offerKey(selectedOffer) : null,
      matchMethod: selectedOffer?.matchMethod || null,
      lineTotal,
    };
  });

  const stores = computeStoreTotalsForCestaItems(items, rows);
  const matched = items.filter((i) => i.matched).length;

  return {
    summary: {
      total: items.length,
      matched,
      unmatched: items.length - matched,
      storesCount: stores.length,
      estimatedBestTotal: items.reduce((acc, i) => acc + (i.lineTotal || 0), 0),
    },
    items,
    stores,
  };
}

/**
 * Totais por mercado respeitando a oferta escolhida em cada item (ou melhor match na loja).
 */
export function computeStoreTotalsForCestaItems(cestaItems, rpcRows) {
  const rows = Array.isArray(rpcRows) ? rpcRows : [];
  if (!cestaItems?.length) return [];

  const byStore = new Map();
  for (const row of rows) {
    const o = normalizeMapOffer(row);
    if (!o) continue;
    const storeKey = String(o.lugar_id || o.nome_loja || '').trim() || 'loja';
    if (!byStore.has(storeKey)) {
      byStore.set(storeKey, {
        storeId: o.lugar_id || null,
        storeName: o.nome_loja,
        lat: o.lat,
        lng: o.lng,
        offers: [],
      });
    }
    byStore.get(storeKey).offers.push(o);
  }

  const stores = [];
  for (const store of byStore.values()) {
    const lines = [];
    let total = 0;
    for (const item of cestaItems) {
      const qty = Number(item.quantidade) || 1;
      const insumoRef = {
        id: item.insumoId,
        nome: item.listName || item.nome,
        canonical_name: item.canonical_name,
        match_termos: item.match_termos,
      };
      const matches = store.offers.filter((o) => {
        if (o._insumoId === item.insumoId) return true;
        return insumoOfferMatches(insumoRef, o.produto_nome).match;
      });
      if (matches.length === 0) continue;

      let chosen = matches[0];
      if (item.selectedOffer?.produto_nome) {
        const wanted = normalizeProductNameForMatch(item.selectedOffer.produto_nome);
        const exact = matches.find(
          (o) => normalizeProductNameForMatch(o.produto_nome) === wanted
        );
        if (exact) chosen = exact;
      }

      const lineTotal = Number((chosen.preco * qty).toFixed(2));
      lines.push({
        insumoId: item.insumoId,
        listName: item.nome,
        productName: chosen.produto_nome,
        price: chosen.preco,
        quantidade: qty,
        lineTotal,
        offerKey: offerKey(chosen),
      });
      total += lineTotal;
    }

    if (lines.length > 0) {
      stores.push({
        storeId: store.storeId,
        storeName: store.storeName,
        lat: store.lat,
        lng: store.lng,
        coveredItems: lines.length,
        totalItems: cestaItems.length,
        coveragePct: Math.round((lines.length / cestaItems.length) * 100),
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

/**
 * @param {Array} insumos
 * @param {Array} rpcRows
 * @param {{ insumoId: string, offer: object|null }[]} patches
 */
export function simulateCestaSelections(insumos, rpcRows, patches) {
  const overrides = {};
  for (const p of patches || []) {
    if (!p?.insumoId) continue;
    overrides[p.insumoId] = p.offer ?? null;
  }
  return buildCestaCompare(insumos, rpcRows, overrides);
}

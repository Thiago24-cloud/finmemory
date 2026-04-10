import { normalizeMapChainText } from './mapStoreChainMatch';

/**
 * Lojas / rótulos que não devem aparecer no mapa de preços.
 * @param {string | null | undefined} name
 */
export function isCarrefourExpressMapLabel(name) {
  const n = normalizeMapChainText(name);
  if (!n) return false;
  return n.includes('carrefour') && n.includes('express');
}

/** Pão de Açúcar, Minuto Pão de Açúcar, Mercado Minuto (mesma rede no matching do mapa). */
export function isPaoDeAcucarMapLabel(name) {
  const n = normalizeMapChainText(name);
  if (!n) return false;
  return (
    n.includes('pao de acucar') ||
    n.includes('minuto pao') ||
    n.includes('minuto mercado') ||
    n.includes('mercado minuto')
  );
}

/** Rede Atacadão (Carrefour) — removida do mapa de preços a pedido do produto. Não confundir com Assaí Atacadista. */
export function isAtacadaoMapLabel(name) {
  const n = normalizeMapChainText(name);
  if (!n) return false;
  if (n.includes('assai') || n.includes('assaí')) return false;
  return n.includes('atacadao') || n.includes('atacadão');
}

/** Filtro único para /api/map/stores, /api/map/points e /api/map/store-offers. */
export function isExcludedFromPriceMapStoreName(name) {
  return (
    isCarrefourExpressMapLabel(name) ||
    isPaoDeAcucarMapLabel(name) ||
    isAtacadaoMapLabel(name)
  );
}

import { normalizeMapChainText } from './mapStoreChainMatch';

/** Fachada curada VM — Rua Isabel de Castela, 33 (ver `data/curadoria/sacolao-vila-madalena-store-e-ajuste-coords.sql`). */
const SAOJORGE_VM_OFFICIAL_LAT = -23.5505;
const SAOJORGE_VM_OFFICIAL_LNG = -46.6833;
/** Só mostrar “Sacolão … Vila Madalena” se o pino estiver perto deste ponto. */
const SAOJORGE_VM_OFFICIAL_RADIUS_KM = 0.82;
/** Clusters de coords erradas na VM (Oscar Freire / praça Cristiano Viana–Horácio Sabino) — não incluem Isabel de Castela. */
const SAOJORGE_VM_GHOST_A_LAT = -23.56145;
const SAOJORGE_VM_GHOST_A_LNG = -46.67285;
const SAOJORGE_VM_GHOST_A_R_KM = 1.08;
const SAOJORGE_VM_GHOST_B_LAT = -23.55995;
const SAOJORGE_VM_GHOST_B_LNG = -46.67445;
const SAOJORGE_VM_GHOST_B_R_KM = 0.62;

function kmBetween(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function inSacolaoVmWrongClusters(la, lo) {
  return (
    kmBetween(la, lo, SAOJORGE_VM_GHOST_A_LAT, SAOJORGE_VM_GHOST_A_LNG) <= SAOJORGE_VM_GHOST_A_R_KM ||
    kmBetween(la, lo, SAOJORGE_VM_GHOST_B_LAT, SAOJORGE_VM_GHOST_B_LNG) <= SAOJORGE_VM_GHOST_B_R_KM
  );
}

/**
 * Sacolão São Jorge: pin/oferta fora do sítio (VM), agente “· ofertas” colado em coords antigas,
 * ou erro de latitude tipo -23,94… (pontos_de_preço).
 * Quando `stores` + `promocoes_supermercados` estiverem só em Isabel de Castela, 33, estes filtros deixam de cortar o pin certo.
 */
export function isSacolaoSaoJorgeWrongOscarFreirePin(name, lat, lng) {
  const n = normalizeMapChainText(name);
  if (!n || !n.includes('sacol') || !n.includes('jorge')) return false;
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;

  const hasVilaMadalena = n.includes('vila') && n.includes('madalena');
  if (hasVilaMadalena) {
    if (
      kmBetween(la, lo, SAOJORGE_VM_OFFICIAL_LAT, SAOJORGE_VM_OFFICIAL_LNG) > SAOJORGE_VM_OFFICIAL_RADIUS_KM
    ) {
      return true;
    }
    return false;
  }

  if (inSacolaoVmWrongClusters(la, lo)) return true;

  if (
    lo >= -47.05 &&
    lo <= -46.45 &&
    la <= -23.62 &&
    la >= -24.25
  ) {
    return true;
  }

  return false;
}

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

/**
 * Linha com nome + coordenadas (price_points, promos agente, stores).
 * Inclui exclusões só por nome e o pin fantasma Sacolão VM (coords erradas).
 */
export function isExcludedFromPriceMapPoint(row) {
  const name = row?.store_name ?? row?.name;
  if (isExcludedFromPriceMapStoreName(name)) return true;
  const lat = row?.lat ?? row?.latitude;
  const lng = row?.lng ?? row?.longitude;
  if (isSacolaoSaoJorgeWrongOscarFreirePin(name, lat, lng)) return true;
  return false;
}

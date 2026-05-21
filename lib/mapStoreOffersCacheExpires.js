/**
 * Calcula `expiresAt` do cache de ofertas por loja (cronogramas de encarte + vigência no BD).
 * Horário de referência: America/Sao_Paulo.
 */

import { inferChainSlugFromStoreDisplayName } from './mapStoreChainMatch';

const SAO_PAULO_TZ = 'America/Sao_Paulo';

/**
 * Dia da semana em que a rede costuma trocar o encarte (0=dom … 6=sáb).
 * Valores aproximados — o servidor pode enviar `cacheExpiresAt` explícito no futuro.
 */
const CHAIN_PROMO_REFRESH_WEEKDAY = Object.freeze({
  assai: 6,
  atacadao: 6,
  carrefour: 2,
  paodeacucar: 2,
  sonda: 2,
  dia: 3,
  mambo: 3,
  hirota: 3,
  lopes: 4,
  saojorge: 1,
  padraosuper: 6,
  agape: 6,
  armazemdocampo: 6,
  pomardavilavilamadalena: 6,
});

/** Fallback quando não há datas nem rede conhecida: 24h. */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function parseYmd(s) {
  if (s == null || s === '') return null;
  const ymd = String(s).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return ymd;
}

function maxYmd(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** Maior data de vigência em ofertas/promoções (valid_until ou valid_dates). */
export function maxPromotionValidityYmd(rows) {
  if (!Array.isArray(rows)) return null;
  let max = null;
  for (const row of rows) {
    const vd = row?.valid_dates;
    if (Array.isArray(vd) && vd.length > 0) {
      for (const d of vd) {
        const y = parseYmd(d);
        if (y) max = maxYmd(max, y);
      }
      continue;
    }
    const vu = parseYmd(row?.valid_until);
    if (vu) max = maxYmd(max, vu);
  }
  return max;
}

/** YYYY-MM-DD “hoje” em São Paulo. */
export function todayYmdSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SAO_PAULO_TZ }).format(new Date());
}

/**
 * Fim do dia civil (23:59:59.999) em SP para um YYYY-MM-DD.
 * @param {string} ymd
 * @returns {string} ISO UTC
 */
export function endOfYmdSaoPauloIso(ymd) {
  if (!ymd) return new Date(Date.now() + DEFAULT_TTL_MS).toISOString();
  // SP sem horário de verão desde 2019 — offset fixo UTC−3
  return new Date(`${ymd}T23:59:59.999-03:00`).toISOString();
}

/**
 * Próximo fim de dia (após `fromDate`) no weekday alvo (0=dom … 6=sáb), em SP.
 * @param {number} targetWeekday
 * @param {Date} [fromDate]
 */
export function nextChainRefreshExpiresIso(targetWeekday, fromDate = new Date()) {
  const todayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: SAO_PAULO_TZ }).format(fromDate);
  const weekdayFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TZ,
    weekday: 'short',
  });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayWd = dayNames.indexOf(weekdayFmt.format(fromDate));
  if (todayWd < 0) {
    return new Date(fromDate.getTime() + DEFAULT_TTL_MS).toISOString();
  }
  let daysAhead = (targetWeekday - todayWd + 7) % 7;
  if (daysAhead === 0) daysAhead = 7;
  const [y, m, d] = todayYmd.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + daysAhead, 12, 0, 0));
  const nextYmd = new Intl.DateTimeFormat('en-CA', { timeZone: SAO_PAULO_TZ }).format(next);
  return endOfYmdSaoPauloIso(nextYmd);
}

/**
 * `expiresAt` sugerido para cache (servidor e cliente).
 * @param {{ store?: { name?: string }, offers?: unknown[], promotions?: unknown[] }} payload
 */
export function computeStoreOffersCacheExpiresAt(payload) {
  const store = payload?.store;
  const offers = payload?.offers;
  const promotions = payload?.promotions;
  const now = Date.now();

  const fromRows = maxPromotionValidityYmd([
    ...(Array.isArray(offers) ? offers : []),
    ...(Array.isArray(promotions) ? promotions : []),
  ]);
  if (fromRows) {
    const endIso = endOfYmdSaoPauloIso(fromRows);
    if (Date.parse(endIso) > now) return endIso;
  }

  const slug = inferChainSlugFromStoreDisplayName(store?.name);
  const refreshWd = slug ? CHAIN_PROMO_REFRESH_WEEKDAY[slug] : undefined;
  if (typeof refreshWd === 'number') {
    return nextChainRefreshExpiresIso(refreshWd);
  }

  return new Date(now + DEFAULT_TTL_MS).toISOString();
}

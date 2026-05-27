/**
 * Vigência de linhas em `public.promotions` (intervalo e/ou datas específicas).
 * Alinhar com `promotions_active` (migration) e America/Sao_Paulo.
 */

/** @returns {string} YYYY-MM-DD */
export function todayIsoSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/**
 * Incluir promoção na listagem “hoje” (painel do mapa, pin).
 * @param {{ valid_from?: string|null, valid_until?: string|null, valid_dates?: string[]|null }} row
 * @param {string} todayYmd YYYY-MM-DD (usar {@link todayIsoSaoPaulo})
 */
export function isPromotionActiveOnDate(row, todayYmd) {
  if (!row || !todayYmd) return false;
  const vd = row.valid_dates;
  if (Array.isArray(vd) && vd.length > 0) {
    const set = new Set(vd.map((d) => String(d).slice(0, 10)));
    return set.has(todayYmd);
  }
  const vf = row.valid_from != null && row.valid_from !== '' ? String(row.valid_from).slice(0, 10) : null;
  const vu = row.valid_until != null && row.valid_until !== '' ? String(row.valid_until).slice(0, 10) : null;
  if (vf && todayYmd < vf) return false;
  if (vu && todayYmd > vu) return false;
  return true;
}

/**
 * Pin no mapa (`/api/map/stores`): campanha ainda no “período do encarte” (entre a menor e a maior data
 * em `valid_dates`), não só no dia de compra. Ex.: seg+sex 06 e 10/04 → quarta 08/04 ainda mantém o pin;
 * o painel (`/api/map/store-offers`) continua a usar {@link isPromotionActiveOnDate}.
 */
export function isPromotionEligibleForMapPin(row, todayYmd) {
  if (!row || !todayYmd) return false;
  const vd = row.valid_dates;
  if (Array.isArray(vd) && vd.length > 0) {
    const sorted = [...new Set(vd.map((d) => String(d).slice(0, 10)))].filter(Boolean).sort();
    if (!sorted.length) return false;
    const minD = sorted[0];
    const maxD = sorted[sorted.length - 1];
    return todayYmd >= minD && todayYmd <= maxD;
  }
  const vf = row.valid_from != null && row.valid_from !== '' ? String(row.valid_from).slice(0, 10) : null;
  const vu = row.valid_until != null && row.valid_until !== '' ? String(row.valid_until).slice(0, 10) : null;
  if (vf && todayYmd < vf) return false;
  if (vu && todayYmd > vu) return false;
  return true;
}

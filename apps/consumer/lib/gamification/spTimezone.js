/** Utilitários de data/hora em America/Sao_Paulo (ofensiva e missões). */

export const SAO_PAULO_TZ = 'America/Sao_Paulo';

/** @returns {Date} "Agora" interpretado no fuso de São Paulo */
export function nowInSaoPaulo() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: SAO_PAULO_TZ }));
}

/** @returns {string} YYYY-MM-DD em São Paulo */
export function todayBR() {
  return nowInSaoPaulo().toISOString().slice(0, 10);
}

/** @returns {string} */
export function yesterdayBR() {
  const d = nowInSaoPaulo();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string | null | undefined} dateA YYYY-MM-DD
 * @param {string | null | undefined} dateB YYYY-MM-DD
 * @returns {number | null}
 */
export function calendarDaysBetween(dateA, dateB) {
  if (!dateA || !dateB) return null;
  const a = new Date(`${dateA}T12:00:00`);
  const b = new Date(`${dateB}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * @param {string | null | undefined} iso
 * @returns {number} horas desde o timestamp (Infinity se ausente)
 */
export function hoursSinceIso(iso) {
  if (!iso) return Infinity;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return Infinity;
  return (Date.now() - ts) / 3600000;
}

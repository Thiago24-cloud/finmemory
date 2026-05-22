/**
 * Chave YYYY-MM para agrupar transações (timezone local do JS para strings ISO/BR).
 * @param {unknown} value
 */
export function getYearMonthKey(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
    const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2]}`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getLatestYear(monthKeys) {
  let latest = null;
  monthKeys.forEach((ym) => {
    const year = parseInt(ym.split('-')[0], 10);
    if (!Number.isNaN(year)) {
      latest = latest === null ? year : Math.max(latest, year);
    }
  });
  return latest;
}

/** Mês civil atual no fuso local do dispositivo (YYYY-MM). */
export function getCurrentYearMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Remove meses futuros (ex.: junho quando ainda estamos em maio). */
export function filterMonthsUpToCurrent(months) {
  const cap = getCurrentYearMonth();
  return (months || []).filter((ym) => typeof ym === 'string' && /^\d{4}-\d{2}$/.test(ym) && ym <= cap);
}

/** Mês inicial do carrossel: mês atual se existir, senão o mais recente até hoje. */
export function pickDefaultDashboardMonth(months) {
  if (!months?.length) return null;
  const cap = getCurrentYearMonth();
  if (months.includes(cap)) return cap;
  const past = months.filter((m) => m <= cap);
  return past[0] ?? months[0];
}

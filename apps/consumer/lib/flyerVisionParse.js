/**
 * Normalização de datas e preços vindos do GPT Vision (encartes BR).
 */

/** Data de hoje em America/Sao_Paulo como YYYY-MM-DD */
export function todaySaoPauloIsoDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/**
 * Aceita YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY.
 * @returns {string|null} YYYY-MM-DD ou null
 */
export function parseFlexibleDateToIso(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

export function parsePromoPriceNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v)
    .replace(/R\$\s*/i, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.')
    .trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Chave de dedupe: mesmo nome + preço + unidade (permite dois produtos com nome parecido). */
export function flyerProductDedupeKey(productName, promoPrice, unit) {
  const n = String(productName || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const u = String(unit || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
  const p =
    promoPrice != null && Number.isFinite(Number(promoPrice))
      ? Number(promoPrice).toFixed(4)
      : '';
  return `${n}|${p}|${u}`;
}

/**
 * @param {number|null} original
 * @param {number|null} promo
 * @returns {number|null}
 */
export function computeDiscountPct(original, promo) {
  const o = original != null ? Number(original) : NaN;
  const p = promo != null ? Number(promo) : NaN;
  if (!Number.isFinite(o) || !Number.isFinite(p) || o <= p || o <= 0) return null;
  return Math.round((1 - p / o) * 100 * 100) / 100;
}

/**
 * Fim do dia (valid_until) em ISO para expira_em do agente — vigência até o último dia inclusivo.
 * @param {string} yyyyMmDd
 */
export function endOfValidDayBrazilIso(yyyyMmDd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return null;
  return `${yyyyMmDd}T23:59:59.999-03:00`;
}

/**
 * Normaliza array vindo do Vision (datas em vários formatos) → YYYY-MM-DD únicos.
 * @param {unknown} raw
 * @returns {string[]|null}
 */
export function normalizeVisionValidDates(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out = [];
  for (const x of raw) {
    const iso = parseFlexibleDateToIso(x);
    if (iso) out.push(iso);
  }
  if (!out.length) return null;
  return [...new Set(out)].sort();
}

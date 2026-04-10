/**
 * Converte preço vindo do mapa/BD (número, "13,90", "R$ 13,90", "13.90 cada") em número positivo.
 * @param {unknown} value
 * @returns {number|null}
 */
export function parsePriceToNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  let s = String(value).trim();
  if (!s) return null;
  s = s
    .replace(/R\$\s*/gi, '')
    .replace(/\s+/g, '')
    .replace(/cada$/i, '')
    .replace(/por$/i, '')
    .trim();
  if (!s) return null;
  // Formato brasileiro: 1.234,56 ou 13,90
  const brDecimal = s.match(/^([\d.]*\d),(\d{1,2})$/);
  if (brDecimal) {
    const intPart = brDecimal[1].replace(/\./g, '');
    const n = Number(`${intPart}.${brDecimal[2]}`);
    if (Number.isFinite(n) && n > 0) return n;
    return null;
  }
  const n = Number(s.replace(',', '.'));
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

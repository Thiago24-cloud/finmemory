/**
 * Converte texto digitado em pt-BR (ex.: "1.000,04" ou "1000,04") em número.
 * Aceita também formato com ponto decimal ("1000.04").
 */
export function parseMoneyInput(raw) {
  if (raw === '' || raw === undefined || raw === null) return null;
  const s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized;
  if (lastComma > lastDot) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    normalized = s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = s.replace(',', '.');
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

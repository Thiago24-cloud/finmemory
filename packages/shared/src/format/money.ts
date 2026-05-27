/**
 * Converte texto digitado em pt-BR (ex.: "1.000,04" ou "1000,04") em número.
 * Aceita também formato com ponto decimal ("1000.04").
 */
export function parseMoneyInput(raw: string | number | null | undefined): number | null {
  if (raw === '' || raw === undefined || raw === null) return null;
  const s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
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

/** Formata valor em Real brasileiro. */
export function formatBRL(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

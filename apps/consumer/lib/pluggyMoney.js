/**
 * Normaliza valores monetários vindos do Pluggy.
 *
 * Alguns conectores retornam amount/balance em centavos inteiros (ex.: 12345),
 * outros já retornam em unidade monetária (ex.: 123.45).
 * Heurística conservadora:
 * - se tiver casas decimais, mantém;
 * - se for inteiro com módulo >= 1000, assume centavos e divide por 100;
 * - caso contrário, mantém.
 */
export function normalizePluggyMoney(rawValue) {
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return 0;
  const hasDecimals = !Number.isInteger(n);
  if (hasDecimals) return n;
  if (Math.abs(n) >= 1000) return n / 100;
  return n;
}


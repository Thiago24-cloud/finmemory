/**
 * @param {string | null | undefined} input
 * @returns {string | null} 14 dígitos ou null se inválido
 */
export function normalizeCnpjDigits(input) {
  if (input == null) return null;
  const d = String(input).replace(/\D/g, '');
  if (d.length !== 14) return null;
  return d;
}

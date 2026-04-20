/**
 * Avalia expressão numérica segura (apenas dígitos, operadores, parênteses, ponto ou vírgula).
 * @param {string} expr
 * @returns {number | null}
 */
export function safeEvalExpression(expr) {
  const s = String(expr || '').replace(/\s+/g, '');
  if (!s || !/^[\d+\-*/().,]+$/.test(s)) return null;
  const normalized = s.replace(/,/g, '.');
  try {
    const fn = new Function(`return (${normalized})`);
    const v = fn();
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return v;
  } catch {
    return null;
  }
}

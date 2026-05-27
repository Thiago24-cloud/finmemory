import { parseMoneyInput } from './parseMoneyInput';
import { safeEvalExpression } from './safeExpressionEval';

function formatPtMoney(n) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Converte texto (valor simples pt-BR ou expressão com + − × ÷) em string de exibição pt-BR.
 * @param {string} raw
 * @returns {string | null} null se inválido ou negativo
 */
export function commitMoneyExpressionToDisplayString(raw) {
  const s = String(raw ?? '').trim().replace(/\s/g, '');
  if (!s) return '';
  if (/[+\-*/()]/.test(s)) {
    const v = safeEvalExpression(s.replace(/,/g, '.'));
    if (v == null || !Number.isFinite(v) || v < 0) return null;
    return formatPtMoney(v);
  }
  const n = parseMoneyInput(s);
  if (n == null || Number.isNaN(n) || !Number.isFinite(n) || n < 0) return null;
  return formatPtMoney(n);
}

/**
 * @param {string} raw
 * @param {{ min?: number; max?: number }} bounds
 * @returns {string | null}
 */
export function commitIntegerString(raw, bounds = {}) {
  const min = bounds.min ?? 1;
  const max = bounds.max ?? 999;
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  let n = parseInt(d, 10);
  if (!Number.isFinite(n)) return null;
  if (n < min) n = min;
  if (n > max) n = max;
  return String(n);
}

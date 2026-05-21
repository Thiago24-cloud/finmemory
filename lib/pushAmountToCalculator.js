/**
 * Envia valor do dashboard para a calculadora (mesmo contrato dos cartões Pluggy).
 * @param {{ appendAmount: Function } | null | undefined} calcDock
 * @param {number} amount
 * @param {'+' | '-'} sign
 * @param {Pick<MouseEvent, 'clientX' | 'clientY'> | undefined} evt
 * @param {string} [flyLabel]
 */
export function pushAmountToCalculator(calcDock, amount, sign, evt, flyLabel) {
  if (!calcDock) return;
  const n = Math.abs(Number(amount));
  if (!Number.isFinite(n) || n === 0) return;
  const label =
    flyLabel ||
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  calcDock.appendAmount(n, sign, {
    allowImplicitJoin: false,
    flyFrom:
      evt && typeof evt.clientX === 'number' && typeof evt.clientY === 'number'
        ? { clientX: evt.clientX, clientY: evt.clientY }
        : undefined,
    flyLabel: label,
  });
}

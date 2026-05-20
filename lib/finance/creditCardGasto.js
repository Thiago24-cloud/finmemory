import { roundMoney } from './contaFinanceira';
import { saldoDisponivelNoCartao } from './contaFinanceira';

/**
 * Valor já gasto no cartão, conforme aparece no dashboard (saldo Open Finance).
 * Negativo = fatura; positivo = muitos conectores mostram o uso acumulado (ex.: R$ 196,18).
 *
 * @param {number} balanceDashboard
 * @returns {number}
 */
export function gastoCartaoFromDashboardBalance(balanceDashboard) {
  const b = Number(balanceDashboard) || 0;
  if (b < 0) return roundMoney(Math.abs(b));
  return roundMoney(b);
}

/**
 * Disponível no cartão = limite manual − gasto (dashboard), mínimo 0.
 *
 * @param {number | null | undefined} limiteTotal
 * @param {number} balanceDashboard
 * @returns {number}
 */
export function saldoCartaoComLimiteManual(limiteTotal, balanceDashboard) {
  const L = Number(limiteTotal);
  if (!Number.isFinite(L) || L <= 0) {
    return saldoDisponivelNoCartao(balanceDashboard, null);
  }
  const gasto = gastoCartaoFromDashboardBalance(balanceDashboard);
  return roundMoney(Math.max(0, L - gasto));
}

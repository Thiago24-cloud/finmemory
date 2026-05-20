/**
 * Modelo agnóstico de contas — sem nomes de banco no código de negócio.
 * @typedef {Object} ContaFinanceira
 * @property {string} id
 * @property {string} nome_banco
 * @property {number} saldo_debito
 * @property {number} limite_credito_disponivel
 */

export function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * Saldo de Hoje (poder de compra real):
 * Σ(saldo_debito) + Σ(limite_credito_disponivel)
 *
 * @param {ContaFinanceira[] | null | undefined} contas
 * @returns {number}
 */
export function calculateSaldoHoje(contas) {
  const list = Array.isArray(contas) ? contas : [];
  let total = 0;
  for (const c of list) {
    total += Number(c.saldo_debito) || 0;
    total += Number(c.limite_credito_disponivel) || 0;
  }
  return roundMoney(total);
}

/** Mock de desenvolvimento — dados dinâmicos, sem hardcode de lógica por banco. */
export const MOCK_CONTAS_FINANCEIRAS = Object.freeze([
  {
    id: 'mock-c6',
    nome_banco: 'C6 Bank',
    saldo_debito: 847.32,
    limite_credito_disponivel: 4120.5,
  },
  {
    id: 'mock-nubank',
    nome_banco: 'Nubank',
    saldo_debito: 1203.18,
    limite_credito_disponivel: 2850,
  },
  {
    id: 'mock-picpay',
    nome_banco: 'PicPay',
    saldo_debito: 156.71,
    limite_credito_disponivel: 980,
  },
]);

/**
 * @param {ContaFinanceira[]} contas
 * @returns {boolean}
 */
export function shouldUseMockContas(contas) {
  if (Array.isArray(contas) && contas.length > 0) return false;
  if (process.env.NEXT_PUBLIC_USE_CONTAS_MOCK === '1') return true;
  return process.env.NODE_ENV === 'development';
}

/**
 * @param {ContaFinanceira[] | null | undefined} contas
 * @returns {ContaFinanceira[]}
 */
export function resolveContasForSaldo(contas) {
  const list = Array.isArray(contas) ? contas : [];
  if (list.length > 0) return list;
  if (shouldUseMockContas(list)) return [...MOCK_CONTAS_FINANCEIRAS];
  return [];
}

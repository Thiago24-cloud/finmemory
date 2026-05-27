import { creditAvailableFromBalanceAndLimit } from '../simuladorHintsBalance';

/**
 * Modelo agnóstico de contas — sem nomes de banco no código.
 * @typedef {Object} ContaFinanceira
 * @property {string} id
 * @property {string} nome_banco
 * @property {number} saldo_debito — dinheiro em conta corrente / à vista
 * @property {number} saldo_cartao_disponivel — quanto ainda pode gastar no cartão (NÃO é o limite total)
 */

export function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * Quanto ainda dá para gastar no cartão de crédito.
 * Ex.: limite 200, fatura/saldo −196 → 4 (não soma os 200 do limite).
 *
 * @param {number} balance — saldo Pluggy (negativo = dívida na fatura)
 * @param {number | null | undefined} limiteTotal — limite cadastrado (manual), opcional
 * @returns {number}
 */
export function saldoDisponivelNoCartao(balance, limiteTotal) {
  return creditAvailableFromBalanceAndLimit(balance, limiteTotal);
}

/**
 * Saldo de Hoje = Σ(saldo_debito) + Σ(saldo_cartao_disponivel)
 *
 * @param {ContaFinanceira[] | null | undefined} contas
 * @returns {number}
 */
export function calculateSaldoHoje(contas) {
  const list = Array.isArray(contas) ? contas : [];
  let total = 0;
  for (const c of list) {
    total += Number(c.saldo_debito) || 0;
    total += Number(c.saldo_cartao_disponivel) || 0;
  }
  return roundMoney(total);
}

/** Mock: 10 débito + 4 no cartão (200 limite, 196 gastos) = 14 */
export const MOCK_CONTAS_FINANCEIRAS = Object.freeze([
  {
    id: 'mock-debito',
    nome_banco: 'Conta débito',
    saldo_debito: 10,
    saldo_cartao_disponivel: 0,
  },
  {
    id: 'mock-cartao',
    nome_banco: 'Cartão de crédito',
    saldo_debito: 0,
    saldo_cartao_disponivel: 4,
  },
]);

/** Mock estendido (3 bancos) — valores de *gasto disponível* no cartão, não limite total */
export const MOCK_CONTAS_TRES_BANCOS = Object.freeze([
  {
    id: 'mock-c6',
    nome_banco: 'C6 Bank',
    saldo_debito: 847.32,
    saldo_cartao_disponivel: 218.5,
  },
  {
    id: 'mock-nubank',
    nome_banco: 'Nubank',
    saldo_debito: 1203.18,
    saldo_cartao_disponivel: 412.0,
  },
  {
    id: 'mock-picpay',
    nome_banco: 'PicPay',
    saldo_debito: 156.71,
    saldo_cartao_disponivel: 95.25,
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
 * @param {{ useTresBancos?: boolean }} [opts]
 * @returns {ContaFinanceira[]}
 */
export function resolveContasForSaldo(contas, opts = {}) {
  const list = Array.isArray(contas) ? contas : [];
  if (list.length > 0) return list;
  if (shouldUseMockContas(list)) {
    return opts.useTresBancos ? [...MOCK_CONTAS_TRES_BANCOS] : [...MOCK_CONTAS_FINANCEIRAS];
  }
  return [];
}

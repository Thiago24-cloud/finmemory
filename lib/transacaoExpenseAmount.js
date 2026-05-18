import { normalizePluggyMoney } from './pluggyMoney.js';

/**
 * Entrada / crédito importado do Open Finance (não é gasto).
 * @param {object} row
 */
export function isTransacaoEntrada(row) {
  const forma = String(row?.forma_pagamento || '').toLowerCase();
  if (forma.includes('entrada')) return true;
  return false;
}

/**
 * Valor em BRL para totais de **gastos** (dashboard, relatórios, carrossel de mês).
 * Ignora entradas Pluggy; NFC-e/OCR contam como despesa (valor absoluto).
 * @param {object} row
 */
export function getExpenseAmountForDashboard(row) {
  if (!row || isTransacaoEntrada(row)) return 0;

  const raw = Number(row?.total) || 0;
  const source = String(row?.source || '').toLowerCase();

  if (source === 'pluggy') {
    const n = normalizePluggyMoney(raw);
    return Number.isFinite(n) ? Math.abs(n) : 0;
  }

  return Math.abs(raw);
}

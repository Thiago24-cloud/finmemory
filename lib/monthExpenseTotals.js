import { filterMonthsUpToCurrent, getYearMonthKey } from './dashboardMonthKey.js';
import { getExpenseAmountForDashboard, isTransacaoEntrada } from './transacaoExpenseAmount.js';

/** Débito bancário que não deve entrar em “gastos do mês” (transferência, fatura já contada nas compras, etc.). */
export function isNonExpenseBankDebit(row) {
  const type = String(row?.type || '').toUpperCase();
  if (type === 'CREDIT') return true;

  const cat = String(row?.category || '').toLowerCase();
  const desc = String(row?.description || '').toLowerCase();
  const blob = `${cat} ${desc}`;

  if (/transfer|entre contas|ted\b|doc\b|pix enviado|envio pix|resgate|aplica[cç][aã]o|investimento/.test(blob)) {
    return true;
  }
  if (/pagamento\s+(de\s+)?fatura|pagto\s+fatura|fatura\s+cart|pagamento\s+cartao|payment\s+to\s+card/.test(blob)) {
    return true;
  }
  return false;
}

/**
 * Agrega gastos por YYYY-MM: Open Finance (bank_transactions DEBIT) + notas/OCR (transacoes sem espelho pluggy).
 * @param {{ bankTransactions?: object[], transacoes?: object[] }} input
 * @returns {{ monthTotals: Record<string, number>, months: string[] }}
 */
export function aggregateMonthExpenseTotals(input = {}) {
  const bankTransactions = Array.isArray(input.bankTransactions) ? input.bankTransactions : [];
  const transacoes = Array.isArray(input.transacoes) ? input.transacoes : [];
  const hasBankMirror = bankTransactions.length > 0;

  /** @type {Record<string, number>} */
  const map = {};

  for (const row of bankTransactions) {
    if (isNonExpenseBankDebit(row)) continue;
    const ym = getYearMonthKey(row.date);
    if (!ym) continue;
    const amt = Math.abs(Number(row.amount) || 0);
    if (amt <= 0) continue;
    map[ym] = (map[ym] || 0) + amt;
  }

  for (const row of transacoes) {
    const source = String(row?.source || '').toLowerCase();
    if (source === 'pluggy' && hasBankMirror) continue;
    const amt = getExpenseAmountForDashboard(row);
    if (amt <= 0) continue;
    const ym = getYearMonthKey(row.data);
    if (!ym) continue;
    map[ym] = (map[ym] || 0) + amt;
  }

  for (const k of Object.keys(map)) {
    map[k] = Math.round(map[k] * 100) / 100;
  }

  const months = Object.keys(map).sort((a, b) => b.localeCompare(a));
  return { monthTotals: map, months };
}

export function filterMonthsToLatestYear(months) {
  if (!months.length) return [];
  let latest = null;
  for (const ym of months) {
    const y = parseInt(ym.split('-')[0], 10);
    if (!Number.isNaN(y)) latest = latest === null ? y : Math.max(latest, y);
  }
  if (latest == null) return months;
  return months.filter((ym) => ym.startsWith(`${latest}-`));
}

/** Ano mais recente + sem meses futuros (carrossel do dashboard). */
export function filterMonthsForDashboard(months) {
  return filterMonthsUpToCurrent(filterMonthsToLatestYear(months));
}

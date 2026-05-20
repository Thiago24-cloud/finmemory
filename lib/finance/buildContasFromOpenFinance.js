import {
  creditAvailableFromBalanceAndLimit,
  isCreditLikeAccount,
} from '../simuladorHintsBalance';
import { roundMoney } from './contaFinanceira';

function nameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

/**
 * Converte contas Open Finance (+ limites manuais de cartão) para o modelo genérico.
 *
 * @param {Array<{ id?: string, name?: string, balance?: unknown, account_type?: string | null }>} accounts
 * @param {Array<number | null | undefined>} [manualCreditLimitsOrdered] — limites na mesma ordem A→Z dos cartões OF
 * @returns {import('./contaFinanceira').ContaFinanceira[]}
 */
export function buildContasFromOpenFinance(accounts, manualCreditLimitsOrdered = []) {
  const list = Array.isArray(accounts) ? accounts : [];

  const creditSorted = [...list]
    .filter((a) => isCreditLikeAccount(a?.account_type, a?.name))
    .sort((a, b) => nameKey(a?.name).localeCompare(nameKey(b?.name), 'pt-BR'));

  const creditLimitByName = new Map();
  creditSorted.forEach((a, i) => {
    const L = manualCreditLimitsOrdered[i];
    creditLimitByName.set(nameKey(a?.name), L != null ? Number(L) : null);
  });

  return list.map((a) => {
    const nome = (a?.name && String(a.name).trim()) || 'Conta';
    const balance = Number(a?.balance) || 0;
    const isCredit = isCreditLikeAccount(a?.account_type, a?.name);
    const id = a?.id != null ? String(a.id) : `of-${nameKey(nome)}`;

    if (isCredit) {
      const L = creditLimitByName.get(nameKey(nome));
      return {
        id,
        nome_banco: nome,
        saldo_debito: 0,
        limite_credito_disponivel: creditAvailableFromBalanceAndLimit(balance, L),
      };
    }

    return {
      id,
      nome_banco: nome,
      saldo_debito: roundMoney(balance),
      limite_credito_disponivel: 0,
    };
  });
}

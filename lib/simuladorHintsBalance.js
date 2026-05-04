/**
 * Saldo / poder de compra para o simulador (Open Finance + cartões manuais).
 *
 * Fórmula de negócio (poder de compra):
 *   Saldo disponível ≈ Σ(saldos em contas à vista / débito) + Σ(crédito_disponível_por_cartão)
 * onde, por conta de crédito, quando existe limite declarado (manual_credit_cards alinhado por ordem):
 *   crédito_disponível = max(0, limite − fatura_atual), com fatura_atual = max(0, −saldo) se o saldo Pluggy for dívida.
 * Se saldo do cartão for positivo (muitos conectores = limite ainda disponível) e existe limite: min(saldo, limite).
 * Sem limite manual: para cartão usa-se max(0, saldo) se o conector já devolve “disponível” como positivo.
 *
 * `account_type` na BD: "TYPE / SUBTYPE" Pluggy (ex.: BANK / CHECKING_ACCOUNT, CREDIT / CREDIT_CARD).
 */

/**
 * @param {string | null | undefined} accountType
 * @param {string | null | undefined} name
 * @returns {boolean}
 */
export function isCreditLikeAccount(accountType, name) {
  const t = String(accountType || '').toUpperCase();
  const n = String(name || '').toUpperCase();
  if (/\bDEBIT\b/.test(t)) return false;
  if (/(^|\/|\s)(CREDIT|CREDITO)(\b|_|\/)/.test(t)) return true;
  if (/CREDIT_CARD/.test(t)) return true;
  if (/CART(A|Ã)O.*\b(CR|CRED|CREDIT)/.test(n)) return true;
  if (/\b(VISA|MASTERCARD|ELO|AMEX)\b/.test(n) && /\bCART/.test(n)) return true;
  return false;
}

function round2(x) {
  return Math.round(Number(x) * 100) / 100;
}

function nameKey(a) {
  return String(a?.name || '').trim().toLowerCase();
}

/**
 * Crédito disponível numa conta, alinhado ao limite manual quando existir.
 * @param {number} balance — saldo Pluggy (negativo = dívida/fatura em muitos bancos)
 * @param {number | null | undefined} creditLimit — limite total do cartão (manual), opcional
 */
export function creditAvailableFromBalanceAndLimit(balance, creditLimit) {
  const b = Number(balance) || 0;
  const L = creditLimit != null && Number.isFinite(Number(creditLimit)) ? Number(creditLimit) : null;
  if (L != null && L > 0) {
    if (b < 0) return round2(Math.max(0, L + b));
    return round2(Math.max(0, Math.min(b, L)));
  }
  return round2(Math.max(0, b));
}

/**
 * @param {Array<{ balance?: unknown, account_type?: string | null, name?: string | null }>} accounts
 * @param {Array<number | null | undefined>} [manualCreditLimitsOrdered] — um limite por conta de crédito (mesma ordem: nome A→Z)
 */
export function computePurchasingPowerHint(accounts, manualCreditLimitsOrdered = []) {
  const list = Array.isArray(accounts) ? accounts : [];
  let naiveSumAllAccounts = 0;

  const creditRows = list
    .filter((a) => isCreditLikeAccount(a?.account_type, a?.name))
    .sort((a, b) => nameKey(a).localeCompare(nameKey(b), 'pt-BR'));
  const debitRows = list.filter((a) => !isCreditLikeAccount(a?.account_type, a?.name));

  let debitAccountsSum = 0;
  let creditAvailableSum = 0;
  /** @type {Array<Record<string, unknown>>} */
  const perAccount = [];

  for (const a of debitRows) {
    const bal = Number(a?.balance) || 0;
    naiveSumAllAccounts += bal;
    debitAccountsSum += bal;
    perAccount.push({
      name: (a?.name && String(a.name).trim()) || 'Conta',
      balance: round2(bal),
      kind: 'checking_like',
      creditLimit: null,
      creditAvailable: null,
      invoiceFromBalance: null,
    });
  }

  for (let i = 0; i < creditRows.length; i += 1) {
    const a = creditRows[i];
    const bal = Number(a?.balance) || 0;
    naiveSumAllAccounts += bal;
    const L = manualCreditLimitsOrdered[i] != null ? Number(manualCreditLimitsOrdered[i]) : null;
    const avail = creditAvailableFromBalanceAndLimit(bal, L);
    creditAvailableSum += avail;
    const invoiceFromBalance = bal < 0 ? round2(-bal) : L != null && L > 0 && bal >= 0 ? round2(Math.max(0, L - bal)) : 0;
    perAccount.push({
      name: (a?.name && String(a.name).trim()) || 'Cartão',
      balance: round2(bal),
      kind: 'credit',
      creditLimit: L != null && L > 0 ? round2(L) : null,
      creditAvailable: avail,
      invoiceFromBalance: invoiceFromBalance > 0 ? invoiceFromBalance : null,
    });
  }

  const purchasingPower = round2(debitAccountsSum + creditAvailableSum);
  const conservativeNet = round2(
    debitAccountsSum -
      creditRows.reduce((acc, a) => {
        const b = Number(a?.balance) || 0;
        return acc + (b < 0 ? -b : 0);
      }, 0)
  );

  return {
    naiveSumAllAccounts: round2(naiveSumAllAccounts),
    debitAccountsSum: round2(debitAccountsSum),
    creditAvailableSum: round2(creditAvailableSum),
    purchasingPower,
    /** À vista − só dívida de cartão (saldo negativo), sem somar limite disponível — referência UX antiga */
    conservativeNet,
    perAccount,
  };
}

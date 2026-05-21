/**
 * Nomes e cores de contas/cartões Pluggy no dashboard.
 * Padrão: "{Banco} Crédito" | "{Banco} Débito" — saldo vermelho (crédito) ou verde (débito).
 */
import { getBankTheme } from './bankThemes';
import { isCreditLikeAccount } from './simuladorHintsBalance';

export const ACCOUNT_KIND_CREDITO = 'credito';
export const ACCOUNT_KIND_DEBITO = 'debito';

/** Vermelho = cartão / dívida; verde = dinheiro em conta. */
export const BALANCE_COLOR_CREDITO = '#EF4444';
export const BALANCE_COLOR_DEBITO = '#22C55E';
export const BALANCE_COLOR_DEBITO_NEG = '#EF4444';

/**
 * @param {string | null | undefined} accountType
 * @param {string | null | undefined} name
 * @returns {'credito' | 'debito'}
 */
export function inferAccountKind(accountType, name) {
  return isCreditLikeAccount(accountType, name) ? ACCOUNT_KIND_CREDITO : ACCOUNT_KIND_DEBITO;
}

/**
 * @param {{
 *   connectorName?: string | null;
 *   name?: string | null;
 *   accountType?: string | null;
 *   connectorId?: string | number | null;
 *   connectorImageUrl?: string | null;
 *   connectorPrimaryColor?: string | null;
 * }} params
 */
export function resolveBankBrandLabel(params = {}) {
  const theme = getBankTheme({
    bankIdentity: params.name,
    connectorName: params.connectorName,
    connectorId: params.connectorId,
    connectorImageUrl: params.connectorImageUrl,
    connectorPrimaryColor: params.connectorPrimaryColor,
  });

  if (theme.label) {
    if (theme.key === 'c6') return 'C6';
    return theme.label;
  }

  const conn = String(params.connectorName || '').trim();
  if (conn) {
    return conn
      .replace(/\s+(bank|brasil|pagamentos?|open\s*finance)\s*$/i, '')
      .trim()
      .slice(0, 48);
  }

  const raw = String(params.name || '').trim();
  if (!raw) return 'Banco';

  const first = raw.split(/[\s·|/]+/)[0];
  return first || raw.slice(0, 32);
}

/**
 * @param {Parameters<typeof resolveBankBrandLabel>[0]} params
 * @returns {string} Ex.: "Nubank Crédito", "PicPay Débito"
 */
export function formatBankAccountDisplayName(params = {}) {
  const brand = resolveBankBrandLabel(params);
  const kind = inferAccountKind(params.accountType, params.name);
  const suffix = kind === ACCOUNT_KIND_CREDITO ? 'Crédito' : 'Débito';
  return `${brand} ${suffix}`;
}

/**
 * @param {'credito' | 'debito'} accountKind
 * @param {number | string | null | undefined} balance
 */
export function getBalanceDisplayColor(accountKind, balance) {
  if (accountKind === ACCOUNT_KIND_CREDITO) return BALANCE_COLOR_CREDITO;
  const n = Number(balance);
  if (Number.isFinite(n) && n < 0) return BALANCE_COLOR_DEBITO_NEG;
  return BALANCE_COLOR_DEBITO;
}

/**
 * @param {Record<string, unknown>} account — linha bank_accounts + connector_*
 */
export function enrichBankAccountForDisplay(account) {
  const accountType = account.account_type != null ? String(account.account_type) : null;
  const name = account.name != null ? String(account.name) : null;
  const accountKind = inferAccountKind(accountType, name);

  const displayParams = {
    connectorName: account.connector_name,
    name,
    accountType,
    connectorId: account.connector_id,
    connectorImageUrl: account.connector_image_url,
    connectorPrimaryColor: account.connector_primary_color,
  };

  return {
    ...account,
    display_name: formatBankAccountDisplayName(displayParams),
    account_kind: accountKind,
    balance_display_color: getBalanceDisplayColor(accountKind, account.balance),
    bank_brand_label: resolveBankBrandLabel(displayParams),
  };
}

/**
 * Desambigua quando há dois cartões "Nubank Crédito" (sufixo ·1234).
 * @param {Array<Record<string, unknown>>} accounts
 */
export function disambiguateDuplicateDisplayNames(accounts) {
  const list = Array.isArray(accounts) ? accounts : [];
  const counts = list.reduce((acc, a) => {
    const key = String(a.display_name || '').trim();
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, /** @type {Record<string, number>} */ ({}));

  return list.map((a) => {
    const base = String(a.display_name || '').trim();
    if (!base || (counts[base] || 0) <= 1) return a;
    const tail =
      String(a.pluggy_account_id || a.id || '')
        .replace(/-/g, '')
        .slice(-4) || '0000';
    return { ...a, display_name: `${base} ·${tail}` };
  });
}

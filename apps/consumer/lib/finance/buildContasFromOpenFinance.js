import { formatBankAccountDisplayNameMinimal } from '../bankAccountDisplay';
import { isCreditLikeAccount } from '../simuladorHintsBalance';
import { saldoCartaoComLimiteManual } from './creditCardGasto';
import { roundMoney } from './contaFinanceira';

function nameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

/**
 * @typedef {Object} LimitsConfig
 * @property {Record<string, number>} [byAccountId] — bank_accounts.id → limite total
 * @property {Array<number | null | undefined>} [orderedFallback] — legado A→Z
 */

/**
 * @param {LimitsConfig | Array<number | null | undefined>} limitsConfig
 * @returns {{ byAccountId: Record<string, number>, orderedFallback: Array<number | null | undefined> }}
 */
function normalizeLimitsConfig(limitsConfig) {
  if (Array.isArray(limitsConfig)) {
    return { byAccountId: {}, orderedFallback: limitsConfig };
  }
  if (limitsConfig && typeof limitsConfig === 'object') {
    return {
      byAccountId: limitsConfig.byAccountId || {},
      orderedFallback: limitsConfig.orderedFallback || [],
    };
  }
  return { byAccountId: {}, orderedFallback: [] };
}

/**
 * Converte contas Open Finance para modelo genérico.
 * Cartão com limite manual: disponível = limite − gasto (valor do dashboard).
 *
 * @param {Array<{
 *   id?: string;
 *   name?: string;
 *   balance?: unknown;
 *   account_type?: string | null;
 *   connector_name?: string | null;
 *   connector_id?: string | number | null;
 *   connector_image_url?: string | null;
 *   connector_primary_color?: string | null;
 * }>} accounts
 * @param {LimitsConfig | Array<number | null | undefined>} [limitsConfig]
 * @returns {import('./contaFinanceira').ContaFinanceira[]}
 */
export function buildContasFromOpenFinance(accounts, limitsConfig = {}) {
  const list = Array.isArray(accounts) ? accounts : [];
  const { byAccountId, orderedFallback } = normalizeLimitsConfig(limitsConfig);

  const creditSorted = [...list]
    .filter((a) => isCreditLikeAccount(a?.account_type, a?.name))
    .sort((a, b) => nameKey(a?.name).localeCompare(nameKey(b?.name), 'pt-BR'));

  const creditLimitByName = new Map();
  creditSorted.forEach((a, i) => {
    const id = a?.id != null ? String(a.id) : '';
    const fromId = id && byAccountId[id] != null ? Number(byAccountId[id]) : null;
    const fromOrder = orderedFallback[i] != null ? Number(orderedFallback[i]) : null;
    creditLimitByName.set(nameKey(a?.name), fromId ?? fromOrder);
  });

  const contas = list.map((a) => {
    const rawName = (a?.name && String(a.name).trim()) || 'Conta';
    const balance = Number(a?.balance) || 0;
    const isCredit = isCreditLikeAccount(a?.account_type, a?.name);
    const id = a?.id != null ? String(a.id) : `of-${nameKey(rawName)}`;
    const displayParams = {
      connectorName: a.connector_name,
      name: rawName,
      accountType: a.account_type,
      connectorId: a.connector_id,
      connectorImageUrl: a.connector_image_url,
      connectorPrimaryColor: a.connector_primary_color,
    };
    const nome_banco = formatBankAccountDisplayNameMinimal(displayParams);

    if (isCredit) {
      const limiteTotal =
        byAccountId[id] != null
          ? Number(byAccountId[id])
          : creditLimitByName.get(nameKey(nome)) ?? null;

      return {
        id,
        nome_banco,
        saldo_debito: 0,
        saldo_cartao_disponivel: saldoCartaoComLimiteManual(limiteTotal, balance),
      };
    }

    return {
      id,
      nome_banco,
      saldo_debito: roundMoney(balance),
      saldo_cartao_disponivel: 0,
    };
  });

  return disambiguateDuplicateNomeBanco(contas);
}

function disambiguateDuplicateNomeBanco(contas) {
  const counts = contas.reduce((acc, c) => {
    const key = String(c.nome_banco || '').trim();
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, /** @type {Record<string, number>} */ ({}));

  return contas.map((c) => {
    const base = String(c.nome_banco || '').trim();
    if (!base || (counts[base] || 0) <= 1) return c;
    const tail = String(c.id || '')
      .replace(/-/g, '')
      .slice(-4) || '0000';
    return { ...c, nome_banco: `${base} ·${tail}` };
  });
}

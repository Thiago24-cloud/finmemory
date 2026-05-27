/**
 * Resolve o asset visual canónico por movimentação (linha Supabase snake_case ou objeto camelCase).
 *
 * @typedef {{ kind: 'logo'; uri: string; backgroundColor?: string | null } | { kind: 'wallet' }} ResolvedInstitutionAsset
 */

import { getBankTheme, bankThemes } from "./bankThemes.js";
import { getBankSimpleIconSlug } from "./bankBrandLogo.js";

/** @param {string} s */
function normalizeSpaces(s) {
  return String(s).replace(/\s+/g, " ").trim();
}

/** @param {string | null | undefined} uri */
function sanitizeHttpsOrRelative(uri) {
  const raw = normalizeSpaces(String(uri || ""));
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  if (/^https:\/\//i.test(raw)) return raw;
  return null;
}

/** @param {string | null | undefined} formaPagamento */
function looksLikeCreditPayment(formaPagamento) {
  const s = normalizeSpaces(
    String(formaPagamento || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
  ).toLowerCase();
  return (
    s.includes("credit") ||
    s.includes("credito") ||
    s.includes("cartao") ||
    s.includes("card") ||
    s.includes("fatura") ||
    s.includes("rotativo")
  );
}

/**
 * Aceita linha `transacoes` / `movimentacoes` (snake_case) ou input parcial em camelCase (ex.: Open Finance em memória).
 * @param {Record<string, unknown> | null | undefined} tx
 * @returns {{
 *   source: string | null;
 *   institutionName: string | null;
 *   institutionLogoUrl: string | null;
 *   institutionConnectorId: string | number | null;
 *   formaPagamento: string | null;
 *   customIconUrl: string | null;
 *   creditInstitutionName: string | null;
 *   creditInstitutionLogoUrl: string | null;
 * }}
 */
export function normalizeTransactionForInstitution(tx) {
  if (!tx || typeof tx !== "object") {
    return {
      source: null,
      institutionName: null,
      institutionLogoUrl: null,
      institutionConnectorId: null,
      formaPagamento: null,
      customIconUrl: null,
      creditInstitutionName: null,
      creditInstitutionLogoUrl: null,
    };
  }

  const o = /** @type {Record<string, unknown>} */ (tx);
  const hasSnake =
    "institution_name" in o ||
    "institution_logo_url" in o ||
    "forma_pagamento" in o ||
    "credit_institution_name" in o ||
    "credit_institution_logo_url" in o ||
    "custom_icon_url" in o;

  if (hasSnake) {
    return {
      source: o.source != null ? String(o.source) : null,
      institutionName: o.institution_name != null ? String(o.institution_name) : null,
      institutionLogoUrl: o.institution_logo_url != null ? String(o.institution_logo_url) : null,
      institutionConnectorId: o.institution_connector_id ?? null,
      formaPagamento: o.forma_pagamento != null ? String(o.forma_pagamento) : null,
      customIconUrl: o.custom_icon_url != null ? String(o.custom_icon_url) : null,
      creditInstitutionName: o.credit_institution_name != null ? String(o.credit_institution_name) : null,
      creditInstitutionLogoUrl:
        o.credit_institution_logo_url != null ? String(o.credit_institution_logo_url) : null,
    };
  }

  return {
    source: o.source != null ? String(o.source) : null,
    institutionName: o.institutionName != null ? String(o.institutionName) : null,
    institutionLogoUrl: o.institutionLogoUrl != null ? String(o.institutionLogoUrl) : null,
    institutionConnectorId: o.institutionConnectorId ?? null,
    formaPagamento: o.formaPagamento != null ? String(o.formaPagamento) : null,
    customIconUrl: o.customIconUrl != null ? String(o.customIconUrl) : null,
    creditInstitutionName: o.creditInstitutionName != null ? String(o.creditInstitutionName) : null,
    creditInstitutionLogoUrl:
      o.creditInstitutionLogoUrl != null ? String(o.creditInstitutionLogoUrl) : null,
  };
}

/** @returns {boolean} */
function isKnownBankTheme(theme) {
  if (!theme?.key) return false;
  if (theme.key === 'default') return false;
  if (String(theme.key).startsWith('connector-')) return false;
  return Boolean(bankThemes[theme.key]);
}

/** @param {ReturnType<typeof getBankTheme>} theme @param {string | null | undefined} pluggyLogo @param {string | null | undefined} institutionName */
function buildLogoAsset(theme, pluggyLogo, institutionName) {
  const known = isKnownBankTheme(theme);
  const slug = getBankSimpleIconSlug(institutionName ?? '');

  let uri = null;
  let logoPad = 'light';

  if (known && theme.logoUrl) {
    uri = theme.logoUrl;
    logoPad = 'brand';
  } else if (slug) {
    uri = `https://cdn.simpleicons.org/${slug}/${theme.textColor === '#111827' ? '003DA5' : 'ffffff'}`;
    logoPad = 'brand';
  } else if (pluggyLogo) {
    uri = pluggyLogo;
    logoPad = 'light';
  } else if (theme.logoUrl) {
    uri = theme.logoUrl;
    logoPad = 'brand';
  }

  if (!uri) return null;

  return {
    kind: 'logo',
    uri,
    backgroundColor: theme.bgColor,
    logoScale: theme.logoScale ?? 1,
    logoPad,
    monogram: theme.label || institutionName || null,
    textColor: theme.textColor,
  };
}

/** @param {Parameters<typeof normalizeTransactionForInstitution>[0]} input */
function resolveFromNormalizedInput(input) {
  const custom = sanitizeHttpsOrRelative(input.customIconUrl);
  if (custom) {
    return { kind: 'logo', uri: custom, logoPad: 'light', logoScale: 1 };
  }

  const useCreditIssuer = looksLikeCreditPayment(input.formaPagamento);
  const issuerOnly = sanitizeHttpsOrRelative(input.creditInstitutionLogoUrl);
  const institutionOnly = sanitizeHttpsOrRelative(input.institutionLogoUrl);
  const pluggyLogo = useCreditIssuer && issuerOnly ? issuerOnly : institutionOnly;
  const displayName = useCreditIssuer
    ? input.creditInstitutionName || input.institutionName
    : input.institutionName;

  const theme = getBankTheme({
    bankIdentity: displayName,
    connectorName: displayName,
    connectorId: input.institutionConnectorId,
    connectorImageUrl: pluggyLogo,
  });

  const logoAsset = buildLogoAsset(theme, pluggyLogo, displayName);
  if (logoAsset) return logoAsset;

  return { kind: 'wallet' };
}

/**
 * Uso nas listagens:
 *   const asset = resolveInstitutionAsset(tx);
 *   <InstitutionAvatar asset={asset} size={40} />
 *
 * @param {Record<string, unknown> | null | undefined} tx
 * @returns {ResolvedInstitutionAsset}
 */
export function resolveInstitutionAsset(tx) {
  const input = normalizeTransactionForInstitution(tx);
  return resolveFromNormalizedInput(input);
}

/**
 * Normaliza conta/cartão (Supabase `bank_accounts` ou objeto enriquecido da API `/api/open-finance/summary`).
 * @param {Record<string, unknown> | null | undefined} account
 * @returns {Record<string, unknown>}
 */
export function normalizeAccountForInstitution(account) {
  if (!account || typeof account !== "object") {
    return {
      institution_name: null,
      institution_logo_url: null,
      institution_connector_id: null,
      custom_icon_url: null,
      source: null,
      forma_pagamento: null,
    };
  }

  const a = /** @type {Record<string, unknown>} */ (account);

  const connectorName =
    a.connector_name != null
      ? String(a.connector_name)
      : a.connectorName != null
        ? String(a.connectorName)
        : null;

  const display =
    (a.institution_name != null ? String(a.institution_name) : null) ||
    connectorName ||
    (a.display_name != null ? String(a.display_name) : null) ||
    (a.marketing_name != null ? String(a.marketing_name) : null) ||
    (a.marketingName != null ? String(a.marketingName) : null) ||
    (a.name != null ? String(a.name) : null) ||
    null;

  const logo =
    (a.institution_logo_url != null ? String(a.institution_logo_url) : null) ||
    (a.connector_image_url != null ? String(a.connector_image_url) : null) ||
    (a.connectorImageUrl != null ? String(a.connectorImageUrl) : null) ||
    null;

  const connId =
    a.institution_connector_id ?? a.connector_id ?? a.connectorId ?? null;

  const custom =
    a.custom_icon_url != null ? String(a.custom_icon_url) : null;

  return {
    institution_name: display,
    institution_logo_url: logo,
    institution_connector_id: connId,
    custom_icon_url: custom,
    source: a.source != null ? String(a.source) : "openfinance",
    forma_pagamento: "",
    credit_institution_name: null,
    credit_institution_logo_url: null,
  };
}

/**
 * Lista de Contas/Cartões (Open Finance ou manual quando tiver campos gravados).
 * Reutiliza a mesma cadeia de fallbacks (`getBankTheme`, Simple Icons) que `resolveInstitutionAsset`.
 *
 * @param {Record<string, unknown> | null | undefined} account
 * @returns {ResolvedInstitutionAsset}
 */
export function resolveAccountAsset(account) {
  const synth = normalizeAccountForInstitution(account);
  const input = normalizeTransactionForInstitution(synth);
  return resolveFromNormalizedInput(input);
}

const DEFAULT_BANK_THEME = {
  key: 'default',
  label: null,
  logoUrl: null,
  logoScale: 1,
  bgColor: '#334155',
  textColor: '#FFFFFF',
  ringColor: 'rgba(148, 163, 184, 0.35)',
};

export const bankThemes = {
  nubank: {
    key: 'nubank',
    label: 'Nubank',
    logoUrl: '/logos/nubank-logo.svg',
    logoScale: 1,
    bgColor: '#8A05BE',
    textColor: '#FFFFFF',
    ringColor: 'rgba(138, 5, 190, 0.45)',
  },
  picpay: {
    key: 'picpay',
    label: 'PicPay',
    logoUrl: '/logos/picpay-logo.svg',
    logoScale: 1,
    bgColor: '#21C25E',
    textColor: '#FFFFFF',
    ringColor: 'rgba(33, 194, 94, 0.45)',
  },
  c6: {
    key: 'c6',
    label: 'C6',
    logoUrl: '/logos/c6-logo.svg',
    logoScale: 1,
    bgColor: '#1A1A1A',
    textColor: '#FFFFFF',
    ringColor: 'rgba(244, 230, 40, 0.55)',
  },
  inter: {
    key: 'inter',
    label: 'Inter',
    logoUrl: '/logos/inter-logo.svg',
    logoScale: 1.02,
    bgColor: '#FF7A00',
    textColor: '#FFFFFF',
    ringColor: 'rgba(255, 122, 0, 0.45)',
  },
  itau: {
    key: 'itau',
    label: 'Itaú',
    logoUrl: null,
    logoScale: 0.88,
    bgColor: '#EC7000',
    textColor: '#FFFFFF',
    ringColor: 'rgba(236, 112, 0, 0.45)',
  },
  bradesco: {
    key: 'bradesco',
    label: 'Bradesco',
    logoUrl: null,
    logoScale: 0.88,
    bgColor: '#CC092F',
    textColor: '#FFFFFF',
    ringColor: 'rgba(204, 9, 47, 0.45)',
  },
  santander: {
    key: 'santander',
    label: 'Santander',
    logoUrl: null,
    logoScale: 0.88,
    bgColor: '#EC0000',
    textColor: '#FFFFFF',
    ringColor: 'rgba(236, 0, 0, 0.45)',
  },
  bancodobrasil: {
    key: 'bancodobrasil',
    label: 'Banco do Brasil',
    logoUrl: null,
    logoScale: 0.88,
    bgColor: '#FECC00',
    textColor: '#003DA5',
    ringColor: 'rgba(254, 204, 0, 0.55)',
  },
  caixa: {
    key: 'caixa',
    label: 'Caixa',
    logoUrl: null,
    logoScale: 0.88,
    bgColor: '#005CA9',
    textColor: '#FFFFFF',
    ringColor: 'rgba(0, 92, 169, 0.45)',
  },
  mercadopago: {
    key: 'mercadopago',
    label: 'Mercado Pago',
    logoUrl: null,
    logoScale: 0.88,
    bgColor: '#00BCFF',
    textColor: '#FFFFFF',
    ringColor: 'rgba(0, 188, 255, 0.45)',
  },
};

function normalizeValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

const HEX_COLOR_RE = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

function isHexColor(value) {
  return HEX_COLOR_RE.test(String(value || '').trim());
}

function normalizeHexColor(value) {
  const hex = String(value || '').trim();
  if (!isHexColor(hex)) return null;
  if (hex.length === 4) {
    const [h, r, g, b] = hex;
    return `${h}${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return hex.toUpperCase();
}

function hexToRgb(hex) {
  const n = normalizeHexColor(hex);
  if (!n) return null;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

function getContrastingTextColor(bgHex) {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#FFFFFF';
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 160 ? '#111827' : '#FFFFFF';
}

function relativeLuminance({ r, g, b }) {
  const srgb = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/** WCAG contrast ratio entre duas cores hex (1–21). */
export function getContrastRatio(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 21;
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const MIN_BALANCE_CONTRAST = 4.5;

/**
 * Cor do saldo no cartão: mantém verde/vermelho semântico quando há contraste;
 * senão usa branco (fundo escuro) ou tons escuros (fundo claro) — ex. PicPay verde + saldo verde.
 * @param {string} bgHex — cor de fundo do cartão
 * @param {'credito' | 'debito'} accountKind
 * @param {number | string | null | undefined} balance
 * @param {string} [semanticColor] — verde débito / vermelho crédito padrão
 */
export function getBalanceColorOnCardBackground(
  bgHex,
  accountKind,
  balance,
  semanticColor = null
) {
  const bg = normalizeHexColor(bgHex) || DEFAULT_BANK_THEME.bgColor;
  const isCredit = accountKind === 'credito';
  const n = Number(balance);
  const isNegative = Number.isFinite(n) && n < 0;

  const semantic =
    semanticColor ||
    (isCredit
      ? '#EF4444'
      : isNegative
        ? '#EF4444'
        : '#22C55E');

  if (getContrastRatio(semantic, bg) >= MIN_BALANCE_CONTRAST) {
    return semantic;
  }

  const darkBg = getContrastingTextColor(bg) === '#FFFFFF';

  if (darkBg) {
    if (isCredit || isNegative) return '#FEE2E2';
    return '#FFFFFF';
  }

  if (isCredit || isNegative) return '#991B1B';
  return '#14532D';
}

function buildRingColor(bgHex) {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return DEFAULT_BANK_THEME.ringColor;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`;
}

function inferThemeKey(...parts) {
  const text = normalizeValue(parts.filter(Boolean).join(' '));
  if (!text) return null;
  if (text.includes('nubank') || text.includes('nu pagamentos') || text.includes('nu payment')) return 'nubank';
  if (text.includes('picpay')) return 'picpay';
  if (text.includes('c6') || text.includes('c6 bank')) return 'c6';
  if (text.includes('inter')) return 'inter';
  if (text.includes('itau') || text.includes('itaú')) return 'itau';
  if (text.includes('bradesco')) return 'bradesco';
  if (text.includes('santander')) return 'santander';
  if (text.includes('banco do brasil') || text.includes('banco brasil')) return 'bancodobrasil';
  if (text.includes('caixa')) return 'caixa';
  if (text.includes('mercado pago') || text.includes('mercadopago')) return 'mercadopago';
  return null;
}

function normalizeLogoUrl(url) {
  const u = String(url || '').trim();
  if (!u) return null;
  if (u.startsWith('/')) return u;
  if (u.startsWith('https://')) return u;
  return null;
}

/**
 * Resolve tema da marca por conta Pluggy (com fallback automático via connector).
 * @param {{
 *   bankIdentity?: string | null;
 *   connectorName?: string | null;
 *   connectorId?: string | number | null;
 *   connectorImageUrl?: string | null;
 *   connectorPrimaryColor?: string | null;
 * }} params
 * @returns {{ key: string; label: string | null; logoUrl: string | null; logoScale: number; bgColor: string; textColor: string; ringColor: string }}
 */
export function getBankTheme(params = {}) {
  const bankIdentity = params?.bankIdentity || null;
  const connectorName = params?.connectorName || null;
  const connectorId = params?.connectorId != null ? String(params.connectorId) : null;
  const connectorImageUrl = normalizeLogoUrl(params?.connectorImageUrl);
  const connectorPrimaryColor = normalizeHexColor(params?.connectorPrimaryColor);

  const key = inferThemeKey(bankIdentity, connectorName, connectorId);
  const known = key && bankThemes[key] ? bankThemes[key] : null;
  if (known) {
    return {
      ...known,
      logoUrl: known.logoUrl || connectorImageUrl || null,
    };
  }

  const bgColor = connectorPrimaryColor || DEFAULT_BANK_THEME.bgColor;
  return {
    ...DEFAULT_BANK_THEME,
    key: connectorId ? `connector-${connectorId}` : DEFAULT_BANK_THEME.key,
    label: connectorName || bankIdentity || null,
    logoUrl: connectorImageUrl || null,
    bgColor,
    textColor: getContrastingTextColor(bgColor),
    ringColor: buildRingColor(bgColor),
  };
}

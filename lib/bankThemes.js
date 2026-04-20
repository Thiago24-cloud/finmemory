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
    label: 'C6 Bank',
    logoUrl: '/logos/c6-logo.svg',
    logoScale: 1.22,
    bgColor: '#212121',
    textColor: '#FFFFFF',
    ringColor: 'rgba(255, 255, 255, 0.22)',
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

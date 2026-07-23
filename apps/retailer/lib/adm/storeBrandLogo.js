/**
 * Logos de redes para o ADM (mesmo matching do mapa consumidor).
 * Usa Google favicon (estável) — equivalente ao proxy /api/map/store-brand-icon.
 */

/** @type {Record<string, string>} chave → hostname */
const STORE_LOGO_DOMAINS = {
  assai: 'assai.com.br',
  'assaí atacadista': 'assai.com.br',
  carrefour: 'carrefour.com.br',
  dia: 'dia.com.br',
  'supermercado dia': 'dia.com.br',
  'pao de acucar': 'gpabr.com',
  'pão de açúcar': 'gpabr.com',
  'pao de açúcar': 'gpabr.com',
  mambo: 'mambo.com.br',
  sonda: 'sonda.com.br',
  lopes: 'supermercadolopes.com.br',
  hirota: 'hirota.com.br',
  'oba hortifruti': 'obahortifruti.com.br',
  oba: 'obahortifruti.com.br',
  extra: 'carrefour.com.br',
  padraosuper: 'padraosuper.com.br',
  'supermercado padrao': 'padraosuper.com.br',
  'supermercado padrão': 'padraosuper.com.br',
  'sacolao sao jorge': 'gruposaojorge.com.br',
  'sacolão são jorge': 'gruposaojorge.com.br',
  pomar: 'pomar.com.br',
};

export function normalizeStoreNameForLogoMatch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameMatchesKey(lower, k) {
  if (!k) return false;
  if (lower === k) return true;
  if (k.length >= 5) return lower.includes(k);
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(lower);
}

/**
 * @param {string} storeName
 * @returns {string|null} URL de logo (favicon 128px)
 */
export function getStoreBrandLogoUrl(storeName) {
  const lower = normalizeStoreNameForLogoMatch(storeName);
  if (!lower) return null;

  const entries = Object.entries(STORE_LOGO_DOMAINS).sort((a, b) => b[0].length - a[0].length);
  const diaHost = STORE_LOGO_DOMAINS.dia;

  for (const [key, host] of entries) {
    const k = normalizeStoreNameForLogoMatch(key);
    if (!k || !nameMatchesKey(lower, k)) continue;
    if (host === diaHost && nameMatchesKey(lower, 'hirota')) continue;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  }
  return null;
}

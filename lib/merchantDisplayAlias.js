/**
 * Apelidos de estabelecimento no dispositivo (mesmo texto bruto do banco/email → nome amigável).
 * @param {string | null | undefined} userId
 */
function storageKey(userId) {
  return `finmemory_merchant_alias_v1:${userId || 'anon'}`;
}

export function normalizeMerchantKey(raw) {
  if (raw == null) return '';
  return String(raw)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** @returns {Record<string, string>} */
export function loadMerchantAliases(userId) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveMerchantAlias(userId, rawLabelFromBank, friendlyName) {
  if (typeof window === 'undefined') return;
  const key = normalizeMerchantKey(rawLabelFromBank);
  const name = String(friendlyName || '').trim();
  if (!key || !name) return;
  const map = loadMerchantAliases(userId);
  map[key] = name;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export function resolveMerchantDisplayName(userId, estabelecimentoFromDb) {
  const raw = String(estabelecimentoFromDb || '').trim() || 'Local não informado';
  const map = loadMerchantAliases(userId);
  const alias = map[normalizeMerchantKey(raw)];
  return alias || raw;
}

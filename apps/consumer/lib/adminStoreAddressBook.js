/**
 * Normalização alinhada à migração SQL `admin_quickadd_norm_text` (trim + minúsculas + espaços colapsados).
 * @param {string | null | undefined} s
 */
export function normalizeAddressKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** @param {string | null | undefined} s */
export function normalizeStoreNameKey(s) {
  return normalizeAddressKey(s);
}

/** @param {string | null | undefined} cnpj */
export function digitsOnlyCnpj(cnpj) {
  return String(cnpj || '').replace(/\D/g, '');
}

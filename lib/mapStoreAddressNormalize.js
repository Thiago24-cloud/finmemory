/**
 * Normaliza endereço para comparar cadastro vs texto colado pelo operador.
 * @param {string} addr
 */
export function normalizeAddressMatchKey(addr) {
  return String(addr || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * O texto colado casa com o endereço gravado (substring ou todas as palavras significativas).
 * @param {string} storedAddress
 * @param {string} typedAddress
 */
export function addressMatchesForStoreRemoval(storedAddress, typedAddress) {
  const s = normalizeAddressMatchKey(storedAddress);
  const t = normalizeAddressMatchKey(typedAddress);
  if (!s || !t || t.length < 5) return false;
  if (s.includes(t) || t.includes(s)) return true;
  const words = t.split(' ').filter((w) => w.length > 2);
  if (words.length === 0) return s.includes(t);
  return words.every((w) => s.includes(w));
}

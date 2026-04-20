/**
 * Texto de ofertas no mapa — limpeza de sufixos técnicos e rótulo de categoria legível.
 */

/**
 * Sufixo do fan-out do agente: "Nome · Nome da Loja #4baee29b" (8 hex do UUID sem hífens).
 * Variante sem UUID na loja: "Nome · Loja #-23.56,-46.69" (fallback de coordenadas).
 */
const FANOUT_SUFFIX_HEX = /\s·\s.+?#\s*[0-9a-fA-F]{8}$/i;
const FANOUT_SUFFIX_COORD = /\s·\s.+?#\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/;

export function stripFanoutProductSuffix(name) {
  const s = String(name || '').trim();
  if (!s) return s;
  let cleaned = s.replace(FANOUT_SUFFIX_HEX, '').replace(FANOUT_SUFFIX_COORD, '').trim();
  return cleaned || s;
}

/**
 * Nome estável para busca de miniatura (Open Food Facts / CSE): remove sufixo de fan-out.
 */
export function productNameForThumbnailSearch(productName) {
  return stripFanoutProductSuffix(String(productName || '').trim());
}

/**
 * Remove prefixo "Nome da loja — / · / - " quando coincide com o cadastro (evita repetir loja no card).
 * @param {string} productName
 * @param {string} [storeDisplayName]
 */
export function stripKnownStorePrefixFromProductName(productName, storeDisplayName) {
  const pn = String(productName || '').trim();
  const sn = String(storeDisplayName || '').trim();
  if (!pn || !sn) return pn;
  const esc = sn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${esc}\\s*(?:[·—-])\\s*`, 'i');
  const out = pn.replace(re, '').trim();
  return out || pn;
}

/**
 * Texto exibido no card: opcionalmente tira prefixo da loja, depois sufixo fan-out.
 * @param {string} productName
 * @param {string} [storeDisplayName] loja do pin / oferta (para limpar "Loja X — produto")
 */
export function displayPromoProductName(productName, storeDisplayName) {
  let s = String(productName || '').trim();
  if (storeDisplayName) s = stripKnownStorePrefixFromProductName(s, storeDisplayName);
  return stripFanoutProductSuffix(s);
}

/**
 * Rótulo pequeno acima do título (ex. categoria). Vazio se for só "Promoção" genérica — estilo vitrine tipo iFood.
 */
export function promoCategoryBadgeLabel(category) {
  const s = promoShelfLabel(category);
  if (!s) return '';
  const t = s.trim().toLowerCase();
  if (t === 'promoção' || t === 'promocao') return '';
  return s;
}

/**
 * Categoria para exibir no card (ex.: "Bebidas" a partir de "Supermercado - Promoção · Bebidas").
 */
export function promoShelfLabel(category) {
  const c = String(category || '').trim();
  if (!c) return '';
  const m = c.match(/Supermercado\s*-\s*Promoção\s*·\s*(.+)/i);
  if (m) return m[1].trim().slice(0, 40);
  const parts = c
    .split(/\s*-\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1].slice(0, 40);
  return c.length > 24 ? '' : c;
}

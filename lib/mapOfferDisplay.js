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
 * Texto exibido no card (fan-out + espaços).
 */
export function displayPromoProductName(productName) {
  return stripFanoutProductSuffix(String(productName || '').trim());
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

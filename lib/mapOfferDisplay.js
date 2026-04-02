/**
 * Texto de ofertas no mapa — limpeza de sufixos técnicos e rótulo de categoria legível.
 */

/** Sufixo do fan-out do agente: mesmo produto em várias lojas → "Nome · Pão de Açúcar #4baee29b". */
const FANOUT_SUFFIX_RE = /\s·\s[^·]+?\s#[0-9a-fA-F]{8}$/;

export function stripFanoutProductSuffix(name) {
  const s = String(name || '').trim();
  if (!s) return s;
  const cleaned = s.replace(FANOUT_SUFFIX_RE, '').trim();
  return cleaned || s;
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

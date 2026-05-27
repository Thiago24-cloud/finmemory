/**
 * Categoria exibida no mapa para linhas de `promocoes_supermercados`.
 * Mantém o prefixo "Supermercado - Promoção" para cores, soma de promo e filtros.
 */
const MAP_PROMO_BASE = 'Supermercado - Promoção';

export function formatAgentPromoMapCategory(categoriaDb) {
  const s = String(categoriaDb || '').replace(/\s+/g, ' ').trim();
  if (!s) return MAP_PROMO_BASE;
  return `${MAP_PROMO_BASE} · ${s.slice(0, 100)}`;
}

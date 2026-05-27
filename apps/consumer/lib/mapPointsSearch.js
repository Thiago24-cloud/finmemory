/**
 * Busca em /api/map/points — PostgREST `.or()` usa vírgula como separador;
 * listas "manga, pera" quebram se forem um único padrão ilike.
 */

const MAX_SEARCH_TERMS = 12;

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function parseMapSearchTerms(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  const split = s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);
  if (split.length > 0) return split.slice(0, MAX_SEARCH_TERMS);
  return s.length >= 2 ? [s] : [];
}

/**
 * Remove caracteres que quebram a gramática de filtros PostgREST.
 * @param {string} term
 */
export function sanitizePostgrestIlikeTerm(term) {
  return String(term || '')
    .replace(/[%_*,().]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * @param {string[]} terms
 * @returns {string | null} — argumento para `.or(...)`
 */
export function buildMapPointsSearchOrFilter(terms) {
  const clauses = [];
  for (const raw of terms) {
    const safe = sanitizePostgrestIlikeTerm(raw);
    if (safe.length < 2) continue;
    const pattern = `%${safe}%`;
    clauses.push(
      `product_name.ilike.${pattern}`,
      `store_name.ilike.${pattern}`,
      `category.ilike.${pattern}`
    );
  }
  return clauses.length > 0 ? clauses.join(',') : null;
}

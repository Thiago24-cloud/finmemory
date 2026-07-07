/**
 * Termos e regras de match insumo ↔ oferta do mapa (Fase 3).
 */
import {
  listItemMatchesOfferName,
  normalizeProductNameForMatch,
} from '../../shoppingListMapCompare';

const STOP_WORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'com',
  'sem',
  'para',
  'em',
  'no',
  'na',
  'um',
  'uma',
  'kg',
  'g',
  'ml',
  'lt',
  'l',
  'un',
  'pct',
  'cx',
]);

export function buildHeuristicMatchTerms(nome) {
  const norm = normalizeProductNameForMatch(nome);
  const terms = new Set();
  if (norm.length >= 2) terms.add(norm);

  const words = norm.split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  for (const w of words) terms.add(w);
  if (words.length >= 2) {
    terms.add(words.slice(0, 2).join(' '));
  }
  if (words.length >= 3) {
    terms.add(words.slice(0, 3).join(' '));
  }

  return [...terms].filter((t) => t.length >= 2).slice(0, 10);
}

export function buildMatchTermsFromCosmos(hit, fallbackNome) {
  const terms = new Set(buildHeuristicMatchTerms(fallbackNome || hit?.name || ''));
  if (hit?.name) {
    const canon = normalizeProductNameForMatch(hit.name);
    if (canon.length >= 2) terms.add(canon);
  }
  if (hit?.brand) {
    const brand = normalizeProductNameForMatch(hit.brand);
    if (brand.length >= 2) terms.add(brand);
    if (hit?.name) {
      const short = normalizeProductNameForMatch(hit.name).split(/\s+/).slice(0, 2).join(' ');
      if (short) terms.add(`${brand} ${short}`.trim());
    }
  }
  return [...terms].filter((t) => t.length >= 2).slice(0, 12);
}

/**
 * @param {{ nome?: string, canonical_name?: string|null, match_termos?: string[]|null, ean?: string|null }} insumo
 */
export function collectInsumoSearchTerms(insumo) {
  const terms = new Set();
  const push = (raw) => {
    const t = String(raw || '').trim();
    if (t.length >= 2) terms.add(t);
  };

  if (Array.isArray(insumo?.match_termos)) {
    for (const t of insumo.match_termos) push(t);
  }
  push(insumo?.canonical_name);
  push(insumo?.nome);

  return [...terms].slice(0, 16);
}

/**
 * @param {{ nome?: string, canonical_name?: string|null, match_termos?: string[]|null }} insumo
 * @param {string} offerName
 * @returns {{ match: boolean, method: string|null }}
 */
export function insumoOfferMatches(insumo, offerName) {
  if (insumo?.canonical_name) {
    if (listItemMatchesOfferName(insumo.canonical_name, offerName)) {
      return { match: true, method: 'canonical' };
    }
  }

  if (Array.isArray(insumo?.match_termos)) {
    for (const term of insumo.match_termos) {
      if (listItemMatchesOfferName(term, offerName)) {
        return { match: true, method: 'term' };
      }
    }
  }

  if (insumo?.nome && listItemMatchesOfferName(insumo.nome, offerName)) {
    return { match: true, method: 'nome' };
  }

  return { match: false, method: null };
}

/**
 * @param {Array<{ nome?: string, canonical_name?: string|null, match_termos?: string[]|null }>} insumos
 */
export function collectRpcSearchTermsForInsumos(insumos) {
  const seen = new Set();
  const out = [];
  for (const insumo of insumos || []) {
    for (const term of collectInsumoSearchTerms(insumo)) {
      const key = normalizeProductNameForMatch(term);
      if (!key || key.length < 2 || seen.has(key)) continue;
      seen.add(key);
      out.push(term);
      if (out.length >= 48) return out;
    }
  }
  return out;
}

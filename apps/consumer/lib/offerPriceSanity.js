/**
 * Rejeita preços claramente inválidos (ex.: arroz 5kg a R$ 3,27).
 */

function norm(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} productName
 * @param {number} price
 * @returns {boolean}
 */
export function isPlausiblePromoPrice(productName, price) {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return false;
  if (p > 8000) return false;

  const n = norm(productName);
  if (!n) return false;

  const kg = n.match(/\b(\d+(?:[.,]\d+)?)\s*kg\b/);
  const kgVal = kg ? Number(String(kg[1]).replace(',', '.')) : null;

  if (/\barroz\b/.test(n)) {
    if (kgVal != null && kgVal >= 4.5 && p < 12) return false;
    if (kgVal != null && kgVal >= 0.8 && kgVal <= 1.2 && p < 2.8) return false;
    if (kgVal == null && p < 2.8) return false;
  }

  if (/\bfeij[aã]o\b/.test(n)) {
    if (kgVal != null && kgVal >= 0.8 && p < 4) return false;
    if (kgVal == null && p < 3) return false;
  }

  if (/\bleite\b/.test(n) && !/\bleite\s+condensado\b|\bleite\s+em\s+po\b/.test(n) && p < 1.8) {
    return false;
  }

  if (/\boleo\b|\bacucar\b|\ba[cç]ucar\b/.test(n) && p < 2.5) return false;

  return true;
}

/**
 * Score de similaridade lista ↔ oferta (maior = melhor).
 */
export function offerNameMatchScore(listName, offerName) {
  const a = norm(listName);
  const b = norm(offerName);
  if (a.length < 2 || b.length < 2) return 0;
  let score = 0;
  if (a === b) score += 100;
  if (b.includes(a)) score += 40;
  if (a.includes(b) && b.length >= 4) score += 20;
  const aWords = a.split(/\s+/).filter((w) => w.length >= 3);
  for (const w of aWords) {
    if (b.includes(w)) score += 8;
  }
  // Preferir embalagem explícita quando a lista não especifica (evita 5kg barato falso vs 1kg)
  if (/\b5\s*kg\b/.test(b)) score += 2;
  return score;
}

/**
 * Escolhe a melhor oferta: score de nome, depois preço plausível mais baixo.
 * @template {{ produto_nome?: string, productName?: string, preco?: number, price?: number }} T
 * @param {string} listName
 * @param {T[]} offers
 * @returns {T | null}
 */
export function pickBestPlausibleOffer(listName, offers) {
  const list = (offers || [])
    .map((o) => {
      const nome = o.produto_nome || o.productName || '';
      const preco = Number(o.preco ?? o.price);
      return { raw: o, nome, preco, score: offerNameMatchScore(listName, nome) };
    })
    .filter((o) => o.score > 0 && isPlausiblePromoPrice(o.nome, o.preco));

  if (!list.length) return null;
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.preco - b.preco;
  });
  return list[0].raw;
}

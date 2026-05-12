/**
 * Emoji decorativo para itens da lista (heurística PT-BR / genérico).
 */
const RULES = [
  [/\b(arroz|rice)\b/i, '🍚'],
  [/\b(leite|milk)\b/i, '🥛'],
  [/\b(p[aã]o|tostada|sand[uú]iche)\b/i, '🍞'],
  [/\b(ma[cç][aã]|banana|laranja|uva|tomate|alface|cebola|batata|cenoura|lim[aã]o)\b/i, '🍎'],
  [/\b(caf[eé]|café)\b/i, '☕'],
  [/\b([aá]gua|refrigerante|suco|cerveja|vinho)\b/i, '🥤'],
  [/\b(carne|frango|peixe|porco|bovino)\b/i, '🥩'],
  [/\b(ovos?|ovo)\b/i, '🥚'],
  [/\b(queijo|manteiga|iogurte)\b/i, '🧀'],
  [/\b(macarr[aã]o|massa|espaguete)\b/i, '🍝'],
  [/\b(feij[aã]o|lentilha)\b/i, '🫘'],
  [/\b([aá]lcool|detergente|sab[aã]o|papel)\b/i, '🧴'],
  [/\b(chocolate|biscoito|bolo)\b/i, '🍫'],
];

export function emojiForShoppingItemName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '🛒';
  const lower = raw.toLowerCase();
  for (const [re, emoji] of RULES) {
    if (re.test(lower)) return emoji;
  }
  return '🛒';
}

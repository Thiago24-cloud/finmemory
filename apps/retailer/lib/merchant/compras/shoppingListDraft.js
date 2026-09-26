/**
 * Lista rápida do lojista (texto livre) — montar antes de comparar preços.
 * Compartilhada entre aba Lista e mapa Preços.
 */
export const SHOPPING_LIST_DRAFT_KEY = 'finmemory_parceiros_lista_compras_v1';
export const SHOPPING_LIST_MAX = 24;

export function normalizeListName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

export function loadShoppingListDraft() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SHOPPING_LIST_DRAFT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => normalizeListName(s))
      .filter((n) => n.length >= 2)
      .slice(0, SHOPPING_LIST_MAX);
  } catch {
    return [];
  }
}

export function saveShoppingListDraft(items) {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = (items || [])
      .map((s) => normalizeListName(s))
      .filter((n) => n.length >= 2)
      .slice(0, SHOPPING_LIST_MAX);
    window.localStorage.setItem(SHOPPING_LIST_DRAFT_KEY, JSON.stringify(cleaned));
  } catch {
    /* ignore */
  }
}

/** Parse "arroz, pera" / multilinha into unique names. */
export function parseDraftInput(raw, existing = []) {
  const seen = new Set(existing.map((n) => n.toLowerCase()));
  const next = [...existing];
  const parts = String(raw || '')
    .split(/[,;\n]+/)
    .map((s) => normalizeListName(s))
    .filter((n) => n.length >= 2);
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(p);
    if (next.length >= SHOPPING_LIST_MAX) break;
  }
  return next;
}

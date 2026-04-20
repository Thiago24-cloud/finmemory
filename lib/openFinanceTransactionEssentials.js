/**
 * Subconjunto mínimo do movimento bancário para UI (evita serializar/clonar o objeto completo).
 * @param {object | null | undefined} t
 * @returns {{ date: string | null; amount: number | null; description: string | null; category: string | null; isCredit: boolean }}
 */
export function pickOpenFinanceEssentialFields(t) {
  if (!t || typeof t !== 'object') {
    return {
      date: null,
      amount: null,
      description: null,
      category: null,
      isCredit: false,
    };
  }
  return {
    date: t.date != null ? String(t.date).slice(0, 10) : null,
    amount: Number.isFinite(Number(t.amount)) ? Number(t.amount) : null,
    description: t.description != null ? String(t.description) : null,
    category: t.category != null ? String(t.category) : null,
    isCredit: String(t.type || '').toUpperCase() === 'CREDIT',
  };
}

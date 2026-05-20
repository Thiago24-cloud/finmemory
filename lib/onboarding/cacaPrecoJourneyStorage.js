/** Jornada gamificada Caça-Preço concluída neste browser. */
export function cacaPrecoJourneyStorageKey(userId) {
  if (!userId || typeof userId !== 'string') return null;
  return `finmemory_caca_preco_journey_v1_${userId}`;
}

export function isCacaPrecoJourneyDoneLocal(userId) {
  if (typeof window === 'undefined' || !userId) return false;
  const k = cacaPrecoJourneyStorageKey(userId);
  return k ? window.localStorage.getItem(k) === '1' : false;
}

export function setCacaPrecoJourneyDoneLocal(userId) {
  if (typeof window === 'undefined' || !userId) return;
  const k = cacaPrecoJourneyStorageKey(userId);
  if (k) window.localStorage.setItem(k, '1');
}

/** Forçar replay (ex.: ?journey=1). */
export function shouldForceCacaPrecoJourney(query) {
  if (!query || typeof query !== 'object') return false;
  const v = query.journey ?? query.caca_preco_journey;
  return v === '1' || v === 'true' || v === 'replay';
}

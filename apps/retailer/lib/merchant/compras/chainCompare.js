/**
 * Agrega totais da cesta por rede (Assaí, Atacadão, Sonda…).
 */

export function inferChainKeyFromStoreName(storeName) {
  const n = String(storeName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!n) return 'outros';
  if (n.includes('assai') || n.includes('assaí')) return 'assai';
  if (n.includes('atacadao') || n.includes('atacadão')) return 'atacadao';
  if (n.includes('sonda')) return 'sonda';
  if (n.includes('dia ') || n.startsWith('dia') || n.includes('dia —') || n.includes('dia -')) return 'dia';
  if (n.includes('mambo')) return 'mambo';
  if (n.includes('hirota')) return 'hirota';
  if (n.includes('pao de acucar') || n.includes('pão de açúcar') || n.includes('paodeacucar')) return 'paodeacucar';
  if (n.includes('carrefour')) return 'carrefour';
  if (n.includes('pomar')) return 'pomardavila';
  if (n.includes('st. marche') || n.includes('st marche') || n.includes('saint marche')) return 'stmarche';
  return 'outros';
}

export const CHAIN_LABELS = {
  assai: 'Assaí',
  atacadao: 'Atacadão',
  sonda: 'Sonda',
  dia: 'DIA',
  mambo: 'Mambo',
  hirota: 'Hirota',
  paodeacucar: 'Pão de Açúcar',
  carrefour: 'Carrefour',
  pomardavila: 'Pomar da Vila',
  stmarche: 'St. Marche',
  outros: 'Outros',
};

/**
 * @param {Array} stores — saída de computeStoreTotalsForCestaItems
 */
export function buildChainCompareFromStores(stores) {
  const byChain = new Map();
  for (const st of stores || []) {
    const key = inferChainKeyFromStoreName(st.storeName);
    const prev = byChain.get(key) || {
      chainKey: key,
      label: CHAIN_LABELS[key] || key,
      bestTotal: Infinity,
      bestStoreName: null,
      bestCoveragePct: 0,
      storeCount: 0,
      lat: null,
      lng: null,
    };
    prev.storeCount += 1;
    const total = Number(st.total);
    const cov = Number(st.coveragePct) || 0;
    if (
      Number.isFinite(total) &&
      (cov > prev.bestCoveragePct || (cov === prev.bestCoveragePct && total < prev.bestTotal))
    ) {
      prev.bestTotal = total;
      prev.bestStoreName = st.storeName;
      prev.bestCoveragePct = cov;
      prev.lat = st.lat ?? null;
      prev.lng = st.lng ?? null;
    }
    byChain.set(key, prev);
  }

  return [...byChain.values()]
    .filter((c) => c.chainKey !== 'outros' || c.storeCount > 0)
    .map((c) => ({
      ...c,
      bestTotal: Number.isFinite(c.bestTotal) ? c.bestTotal : null,
    }))
    .sort((a, b) => {
      if ((b.bestCoveragePct || 0) !== (a.bestCoveragePct || 0)) {
        return (b.bestCoveragePct || 0) - (a.bestCoveragePct || 0);
      }
      return (a.bestTotal ?? Infinity) - (b.bestTotal ?? Infinity);
    });
}

/** Redes típicas de atacado para filtro do mapa. */
export function isAtacadoStoreName(storeName) {
  const key = inferChainKeyFromStoreName(storeName);
  return key === 'assai' || key === 'atacadao';
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

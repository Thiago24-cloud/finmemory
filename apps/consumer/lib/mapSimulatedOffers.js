/**
 * Ofertas simuladas / demo que não devem aparecer no mapa público.
 * Ex.: cesta simulada `[sim-cesta]`, seeds demo_seed, produtos marcados "(demo rede)".
 */

const SIMULATED_PRODUCT_PATTERNS = [
  /\[sim-cesta\]/i,
  /\(demo\s*rede\)/i,
  /\(demo\)/i,
];

const SIMULATED_SOURCES = new Set(['demo_seed:redes_mapa:v1']);

export function isSimulatedMapProductName(productName) {
  const name = String(productName || '').trim();
  if (!name) return false;
  return SIMULATED_PRODUCT_PATTERNS.some((re) => re.test(name));
}

export function isSimulatedMapIngestSource(ingestSource) {
  const src = String(ingestSource || '').trim();
  if (!src) return false;
  return SIMULATED_SOURCES.has(src);
}

/** Filtra linhas de price_points / offer preview antes de montar o JSON do mapa. */
export function filterSimulatedMapOffers(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows || [];
  return rows.filter((row) => !isSimulatedMapProductName(row?.product_name));
}

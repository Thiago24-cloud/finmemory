/**
 * Ofertas simuladas / demo que não devem aparecer no mapa público.
 */
const SIMULATED_PRODUCT_PATTERNS = [/\[sim-cesta\]/i, /\(demo\s*rede\)/i, /\(demo\)/i];
const SIMULATED_SOURCES = new Set(['demo_seed:redes_mapa:v1']);

export function isSimulatedMapProductName(productName) {
  const name = String(productName || '').trim();
  if (!name) return false;
  return SIMULATED_PRODUCT_PATTERNS.some((re) => re.test(name));
}

export function isSimulatedMapIngestSource(ingestSource) {
  return SIMULATED_SOURCES.has(String(ingestSource || '').trim());
}

export function filterSimulatedMapOffers(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows || [];
  return rows.filter((row) => !isSimulatedMapProductName(row?.product_name || row?.nome_produto));
}

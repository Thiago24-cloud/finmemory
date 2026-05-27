/**
 * Cosmos Bluesoft API — só em código de servidor (API routes, etc.).
 * Definir COSMOS_API_TOKEN no Cloud Run ou .env.local (nunca NEXT_PUBLIC_*).
 * Uso: lib/gtinProductLookup.js (fallback de nome por GTIN quando Open Food Facts não tem).
 */

export function getCosmosToken() {
  const token = process.env.COSMOS_API_TOKEN?.trim();
  return token || null;
}

/** Corpo JSON + status para quando o token não está configurado (ex.: res.status(503).json(...)). */
export function cosmosUnavailablePayload() {
  return {
    error: 'Integração Cosmos indisponível.',
    code: 'COSMOS_CONFIG',
  };
}

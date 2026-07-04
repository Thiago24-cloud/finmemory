/**
 * Cosmos Bluesoft API — uso exclusivo em código de servidor.
 * Defina COSMOS_API_TOKEN no Cloud Run ou .env.local.
 */

export function getCosmosToken() {
  const token = process.env.COSMOS_API_TOKEN?.trim();
  return token || null;
}

export function cosmosUnavailablePayload() {
  return {
    error: 'Integração Cosmos indisponível.',
    code: 'COSMOS_CONFIG',
  };
}

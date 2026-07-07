/**
 * Cosmos Bluesoft — token só no servidor (Cloud Run / .env.local).
 * Nunca usar NEXT_PUBLIC_* para o token.
 */
export function getCosmosToken(): string | null {
  const token = process.env.COSMOS_API_TOKEN?.trim();
  return token || null;
}

export function cosmosUnavailablePayload() {
  return {
    error: 'Integração Cosmos indisponível.',
    code: 'COSMOS_CONFIG',
  };
}

/** Segredo opcional para chamadas retailer → consumer na rota /api/catalog/cosmos/lookup */
export function getCosmosLookupSecret(): string | null {
  const secret =
    process.env.COSMOS_LOOKUP_SECRET?.trim() ||
    process.env.FINMEMORY_COSMOS_PROXY_SECRET?.trim();
  return secret || null;
}

export function isCosmosLookupAuthorized(
  headerSecret: string | null | undefined,
  querySecret?: string | null
): boolean {
  const expected = getCosmosLookupSecret();
  if (!expected) return true;
  const provided = String(headerSecret || querySecret || '').trim();
  return provided === expected;
}

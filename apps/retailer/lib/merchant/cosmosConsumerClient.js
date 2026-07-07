/**
 * Cliente Cosmos via app consumidor — uma única API/token no consumer.
 * O painel lojista nunca chama api.cosmos.bluesoft.com.br diretamente.
 */
import { getCosmosLookupSecret } from '@finmemory/shared/cosmos';
import { getConsumerAppBaseUrl } from '../consumerAppUrl';

function cosmosLookupHeaders() {
  const headers = { Accept: 'application/json' };
  const secret = getCosmosLookupSecret();
  if (secret) headers['X-Finmemory-Cosmos-Secret'] = secret;
  return headers;
}

function buildCosmosLookupUrl(params) {
  const base = getConsumerAppBaseUrl();
  const qs = new URLSearchParams(params);
  return `${base}/api/catalog/cosmos/lookup?${qs}`;
}

async function parseCosmosLookupResponse(res) {
  const body = await res.json().catch(() => ({}));
  if (res.status === 503 && body?.code === 'COSMOS_CONFIG') {
    return { unavailable: true, body, status: res.status };
  }
  if (res.status === 401) {
    const err = new Error(body?.error || 'Cosmos lookup não autorizado');
    err.status = 401;
    err.body = body;
    throw err;
  }
  if (!res.ok && res.status !== 404) {
    const err = new Error(body?.error || `Cosmos lookup HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return { unavailable: false, body, status: res.status };
}

function throwCosmosUnavailable(body) {
  const err = new Error('Integração Cosmos indisponível.');
  err.status = 503;
  err.body = body || { code: 'COSMOS_CONFIG' };
  throw err;
}

/**
 * @param {Record<string, string>} params
 */
export async function fetchConsumerCosmosLookup(params) {
  const url = buildCosmosLookupUrl(params);
  const res = await fetch(url, {
    headers: cosmosLookupHeaders(),
    signal: AbortSignal.timeout(18_000),
  }).catch((error) => {
    const err = new Error(
      `Falha ao contactar API Cosmos (${getConsumerAppBaseUrl()}): ${error?.message || error}`
    );
    err.cause = error;
    throw err;
  });

  return parseCosmosLookupResponse(res);
}

export async function fetchCosmosProductByGtin(gtin) {
  const code = String(gtin || '').replace(/\D/g, '');
  if (!code) return null;

  const { unavailable, body, status } = await fetchConsumerCosmosLookup({ gtin: code });
  if (unavailable) throwCosmosUnavailable(body);
  if (status === 404 || body?.found === false) return null;
  return body?.product || null;
}

export async function searchCosmosProductsByQuery(query) {
  const q = String(query || '').trim();
  if (q.length < 3) return [];

  const { unavailable, body } = await fetchConsumerCosmosLookup({
    query: q,
    mode: 'search',
  });
  if (unavailable) throwCosmosUnavailable(body);
  return Array.isArray(body?.products) ? body.products : [];
}

export async function resolveCosmosProductImage({ gtin, name }) {
  const params = { mode: 'resolve' };
  if (gtin) params.gtin = String(gtin).replace(/\D/g, '');
  if (name) params.name = String(name).trim();

  const { unavailable, body, status } = await fetchConsumerCosmosLookup(params);
  if (unavailable) throwCosmosUnavailable(body);
  if (status === 404 || body?.found === false) return null;
  return body?.product || null;
}

export function isCosmosConsumerUnavailableError(error) {
  return error?.body?.code === 'COSMOS_CONFIG' || error?.status === 503;
}

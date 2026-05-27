import { getCosmosToken } from '../cosmos.js';
import { fetchCosmosBluesoftByGtin } from '../gtinProductLookup.js';

const COSMOS_ORIGIN = 'https://api.cosmos.bluesoft.com.br';

function normalizeGtin(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

/**
 * @param {string} productName
 * @returns {Promise<{ gtin: string, imageUrl: string, name: string } | null>}
 */
export async function searchCosmosProductByName(productName) {
  const token = getCosmosToken();
  const q = String(productName || '').trim();
  if (!token || q.length < 3) return null;

  const headers = {
    'X-Cosmos-Token': token,
    'User-Agent': 'FinMemory/1.0 (catalog-image-enrich)',
    Accept: 'application/json, text/html;q=0.9',
  };

  const descriptionUrl = `${COSMOS_ORIGIN}/gtins?description=${encodeURIComponent(q)}`;
  const fromDescription = await fetchCosmosJsonOrGtin(descriptionUrl, headers);
  if (fromDescription) return fromDescription;

  const searchUrl = `${COSMOS_ORIGIN}/pesquisar?class=Product&q=${encodeURIComponent(q)}`;
  const htmlRes = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!htmlRes?.ok) return null;

  const body = await htmlRes.text();
  const gtinMatch =
    body.match(/\/gtins\/(\d{8,14})/i) ||
    body.match(/"gtin"\s*:\s*(\d{8,14})/i) ||
    body.match(/gtin["']?\s*[:=]\s*["']?(\d{8,14})/i);
  const gtin = normalizeGtin(gtinMatch?.[1]);
  if (!gtin) return null;

  const row = await fetchCosmosBluesoftByGtin(gtin);
  if (!row?.imageUrl) return null;
  return { gtin, imageUrl: row.imageUrl, name: row.name || q };
}

/**
 * @param {string} url
 * @param {Record<string, string>} headers
 */
async function fetchCosmosJsonOrGtin(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!res?.ok) return null;

  const text = await res.text();
  const ct = (res.headers.get('content-type') || '').toLowerCase();

  if (ct.includes('application/json')) {
    try {
      const j = JSON.parse(text);
      const list = Array.isArray(j) ? j : j?.products || j?.gtins || j?.data || [];
      const first = Array.isArray(list) ? list[0] : j;
      const gtin = normalizeGtin(first?.gtin ?? first?.ean ?? j?.gtin);
      const thumb = first?.thumbnail ?? first?.image_url ?? j?.thumbnail;
      if (gtin && thumb) {
        return {
          gtin,
          imageUrl: String(thumb).trim(),
          name: String(first?.description || first?.name || '').trim(),
        };
      }
      if (gtin) {
        const row = await fetchCosmosBluesoftByGtin(gtin);
        if (row?.imageUrl) {
          return { gtin, imageUrl: row.imageUrl, name: row.name || '' };
        }
      }
    } catch {
      /* HTML / texto abaixo */
    }
  }

  const gtin = normalizeGtin(text.match(/\/gtins\/(\d{8,14})/i)?.[1]);
  if (!gtin) return null;
  const row = await fetchCosmosBluesoftByGtin(gtin);
  if (!row?.imageUrl) return null;
  return { gtin, imageUrl: row.imageUrl, name: row.name || '' };
}

/**
 * Resolve imagem no Cosmos (GTIN direto ou busca por nome).
 * @param {{ nome?: string, name?: string, product_name?: string, gtin?: string, ean?: string, barcode?: string }} product
 */
export async function resolveCosmosImageForProduct(product) {
  const gtin = normalizeGtin(
    product?.gtin ?? product?.ean ?? product?.barcode ?? product?.codigo_barras ?? product?.raw?.gtin
  );
  if (gtin) {
    const row = await fetchCosmosBluesoftByGtin(gtin);
    if (row?.imageUrl) {
      return { source: 'cosmos_gtin', gtin, imageUrl: row.imageUrl, name: row.name };
    }
  }

  const name =
    String(product?.nome || product?.name || product?.product_name || '').trim() ||
    String(product?.raw?.nome || product?.raw?.name || '').trim();
  if (!name) return null;

  const searched = await searchCosmosProductByName(name);
  if (!searched?.imageUrl) return null;
  return {
    source: 'cosmos_search',
    gtin: searched.gtin,
    imageUrl: searched.imageUrl,
    name: searched.name || name,
  };
}

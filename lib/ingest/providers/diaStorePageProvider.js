import {
  INGEST_SOURCE_DIA_STORE_PAGE,
  SP_GRANDE_SP_CITIES,
  buildDiaGptPromoRun,
  detectStatewideOffer,
  inferDddByCity,
  inferMacroRegion,
  normalizeGeoText,
} from '../run.js';
import { ProviderValidationError, assertOnlySpFromHints } from './base.js';

function inferCityFromParsed(parsed) {
  const candidates = [
    parsed?.store_city,
    parsed?.city,
    parsed?.cidade,
    parsed?.store_name,
  ];
  for (const c of candidates) {
    const text = String(c || '').trim();
    if (!text) continue;
    const split = text.split(/[-,/|]/).map((part) => part.trim()).filter(Boolean);
    for (const part of split) {
      const t = normalizeGeoText(part);
      if (t.length >= 3 && t !== 'sp' && t !== 'sao paulo - sp') return part;
    }
  }
  return null;
}

function inferScopeByCity(city) {
  if (!city) return 'Estadual';
  return SP_GRANDE_SP_CITIES.has(normalizeGeoText(city)) ? 'Grande SP' : 'Cidade';
}

export function buildDiaStorePageProviderPayload(context) {
  const { parsed, lat, lng, runId, storeUrl } = context;
  assertOnlySpFromHints(parsed);
  const built = buildDiaGptPromoRun(parsed, {
    lat,
    lng,
    runId,
    storePageUrl: storeUrl,
    mapCategory: 'Supermercado - Promoção',
  });
  if ('error' in built) {
    throw new ProviderValidationError(built.error);
  }

  const city = inferCityFromParsed(parsed);
  const isStatewide = detectStatewideOffer(parsed);
  const resolvedCity = isStatewide ? null : city;
  const localityScope = isStatewide ? 'Estadual' : inferScopeByCity(city);
  const localityRegion = resolvedCity ? inferMacroRegion(resolvedCity) : null;
  const dddCode = resolvedCity ? inferDddByCity(resolvedCity) : null;

  const produtos = (built.items || []).map((item) => ({
    product_name: item.productName,
    current_price: item.price,
    original_price: item.originalPrice ?? null,
    unit: item.unit || null,
    expiry_date: item.validUntil || null,
    image_url: item.imageUrl || null,
    locality_city: resolvedCity,
    locality_state: 'SP',
    locality_region: localityRegion,
    ddd_code: dddCode,
    is_statewide: Boolean(isStatewide),
    metadata: {
      source: INGEST_SOURCE_DIA_STORE_PAGE,
        extraction_strategy: 'provider_structured',
    },
  }));

  if (produtos.length === 0) {
    throw new ProviderValidationError('Nenhuma oferta válida com validade explícita para SP');
  }

  return {
    storeName: built.storeDisplayName,
    storeAddress: built.storeAddress || null,
    storeLat: lat,
    storeLng: lng,
    localityScope,
    localityCity: resolvedCity,
    localityRegion,
    localityState: 'SP',
    dddCode,
    isStatewide: Boolean(isStatewide),
    origem: INGEST_SOURCE_DIA_STORE_PAGE,
    produtos,
  };
}


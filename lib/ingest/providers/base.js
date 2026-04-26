import {
  detectStatewideOffer,
  inferDddByCity,
  inferMacroRegion,
} from '../run.js';
import { validateUnifiedProviderItem } from '../utils/validator.js';
import { pushIngestRejection } from '../rejectionLog.js';

export class ProviderValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ProviderValidationError';
    this.details = details;
  }
}

/**
 * @typedef {object} ProviderContext
 * @property {string} runId
 * @property {string} source
 * @property {any} parsed
 * @property {number} lat
 * @property {number} lng
 * @property {string} [storeUrl]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {object} ProviderResult
 * @property {string} storeName
 * @property {string|null} storeAddress
 * @property {number} storeLat
 * @property {number} storeLng
 * @property {'Estadual'|'Grande SP'|'Cidade'} localityScope
 * @property {string|null} localityCity
 * @property {'Capital'|'Interior'|'Litoral'|null} [localityRegion]
 * @property {'SP'} localityState
 * @property {string|null} [dddCode]
 * @property {boolean} [isStatewide]
 * @property {string} origem
 * @property {Array<object>} produtos
 */

/**
 * Normaliza rótulos de unidade vindos de encartes/APIs (ex.: "Kilograma", "KG", "Kg." → "kg").
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeUnit(raw) {
  if (raw == null) return null;
  let t = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.\s]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!t) return null;

  if (/^(kg|kgs|kilograma|kilogramas|quilo|quilos)$/.test(t)) return 'kg';
  if (/^(un|und|unid|unidade|unidades|pc|pç|peca|pecas)$/.test(t)) return 'un';
  if (/^(l|lt|litro|litros)$/.test(t)) return 'litro';
  if (/^(ml|mililitro|mililitros)$/.test(t)) return 'ml';
  if (/^(g|gr|grama|gramas)$/.test(t)) return 'g';
  if (/^(pct|pacote|pacotes|pack)$/.test(t)) return 'pct';

  return t.slice(0, 24);
}

/**
 * Rejeita hints explícitos de UF diferente de SP.
 * @param {Record<string, unknown>} parsed
 */
export function assertOnlySpFromHints(parsed) {
  const hints = [
    parsed?.store_state,
    parsed?.state,
    parsed?.uf,
    parsed?.store_uf,
    parsed?.region_uf,
  ]
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean);
  if (hints.length > 0 && hints.some((v) => v !== 'SP')) {
    throw new ProviderValidationError('Metadados indicam oferta fora do Estado de São Paulo', {
      stateHints: hints,
    });
  }
}

/**
 * Exige vínculo explícito com SP (UF nos metadados).
 * Usado pelo registry e pelos stubs antes de qualquer escrita.
 * @param {ProviderContext & { metadata?: Record<string, unknown> }} context
 */
export function assertContextLinkedToSaoPaulo(context) {
  const parsed = context?.parsed && typeof context.parsed === 'object' ? context.parsed : {};
  const meta = context?.metadata && typeof context.metadata === 'object' ? context.metadata : {};

  const explicitHints = [
    parsed.store_state,
    parsed.state,
    parsed.uf,
    parsed.store_uf,
    meta.state,
    meta.uf,
    meta.region_state,
  ]
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean);

  const hasExplicitSp = explicitHints.includes('SP');
  const hasExplicitNonSp = explicitHints.length > 0 && !hasExplicitSp;

  if (hasExplicitNonSp) {
    throw new ProviderValidationError(
      'Payload sem vínculo ao Estado de São Paulo: UF explícita diferente de SP',
      { explicitHints }
    );
  }

  if (hasExplicitSp) {
    assertOnlySpFromHints(parsed);
    return;
  }

  throw new ProviderValidationError(
    'Payload bloqueado: é obrigatório conter UF/estado explícito SP nos metadados',
    { explicitHints }
  );
}

/**
 * Validação final antes de enfileirar — reforço no registry.
 * @param {ProviderResult} result
 * @param {string} [providerKey]
 */
export function validateProviderResultLinkedToSp(result, providerKey = '') {
  if (!result || typeof result !== 'object') {
    throw new ProviderValidationError('Resultado do provider inválido', { providerKey });
  }
  if (result.localityState !== 'SP') {
    throw new ProviderValidationError('Resultado rejeitado: localityState deve ser SP antes do Supabase', {
      providerKey,
      localityState: result.localityState,
    });
  }
  const produtos = Array.isArray(result.produtos) ? result.produtos : [];
  for (let i = 0; i < produtos.length; i++) {
    const p = produtos[i];
    if (p && p.locality_state != null && String(p.locality_state).toUpperCase() !== 'SP') {
      throw new ProviderValidationError('Produto com locality_state diferente de SP', {
        providerKey,
        index: i,
      });
    }
    if (p && p.is_statewide != null && typeof p.is_statewide !== 'boolean') {
      throw new ProviderValidationError('Produto com is_statewide inválido', {
        providerKey,
        index: i,
      });
    }
  }
}

function toIsoDateOrNull(value) {
  if (!value) return null;
  const d = new Date(String(value).trim());
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function fallbackExpiry48hIso() {
  return new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
}

/**
 * Classe base para providers de flyer (Mambo, Pão de Açúcar, Carrefour, etc.).
 * Subclasses implementam `extract(context)` com a lógica específica da rede.
 */
export class FlyerProviderBase {
  /**
   * @param {string} origem identificador estável (ex.: pao_de_acucar_flyer)
   */
  constructor(origem) {
    this.origem = origem;
  }

  /**
   * @param {ProviderContext} context
   * @returns {ProviderResult}
   */
  build(context) {
    assertContextLinkedToSaoPaulo(context);
    const rawResult = this.extract(context);
    const normalized = this.normalizeProviderResult(rawResult, context);
    return normalized;
  }

  /**
   * Contrato obrigatório para todos os providers.
   * @param {object} item
   * @param {ProviderContext} context
   * @param {object} result
   * @returns {{
   *  product_name: string,
   *  current_price: number,
   *  original_price: number | null,
   *  unit: string,
   *  locality_city: string,
   *  locality_state: 'SP',
   *  locality_region: 'Capital'|'Interior'|'Litoral',
   *  ddd_code: number,
   *  is_statewide: boolean,
   *  expiry_date: string,
   *  image_url: string,
   *  metadata: { source: string, validity_inferred: boolean, extraction_strategy: string }
   * }}
   */
  normalizePayload(item, context, result) {
    const source = String(this.origem || context?.source || 'provider_unknown');
    const productName = String(
      item?.product_name ?? item?.nome ?? item?.name ?? item?.productName ?? ''
    ).trim();
    const currentPrice = Number(item?.current_price ?? item?.preco ?? item?.price ?? item?.promo_price);
    const originalMaybe = Number(item?.original_price ?? item?.preco_de ?? item?.price_from);
    const originalPrice = Number.isFinite(originalMaybe) && originalMaybe > 0 ? originalMaybe : null;
    const unit = normalizeUnit(item?.unit ?? item?.unidade) || 'un';

    let localityCity = String(
      item?.locality_city ?? item?.cidade ?? result?.localityCity ?? ''
    ).trim();
    const isStatewide = Boolean(
      item?.is_statewide ??
      result?.isStatewide ??
      detectStatewideOffer({
        ...(context?.parsed || {}),
        ...(item || {}),
      })
    );

    if (!localityCity) {
      localityCity = 'São Paulo';
      console.warn('[ingest.normalizePayload] fallback locality_city=São Paulo', {
        source,
        runId: context?.runId || null,
        product_name: productName || null,
      });
    }

    const localityRegion = inferMacroRegion(localityCity) || 'Capital';
    const dddMaybe = Number(item?.ddd_code ?? result?.dddCode ?? inferDddByCity(localityCity));
    const dddCode = Number.isFinite(dddMaybe) ? dddMaybe : 11;

    const expiryIso = toIsoDateOrNull(item?.expiry_date ?? item?.valid_until ?? item?.validade ?? item?.expires_at);
    const validityInferred = !expiryIso;
    const expiryDate = expiryIso || fallbackExpiry48hIso();
    const imageUrl = String(item?.image_url ?? item?.imagem_url ?? item?.promo_image_url ?? '').trim();
    const extractionStrategy = String(
      item?.metadata?.extraction_strategy ??
      item?.extraction_strategy ??
      'unknown'
    ).trim() || 'unknown';

    if (!productName) {
      throw new ProviderValidationError('Item sem product_name no contrato unificado', { source });
    }
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new ProviderValidationError('Item sem current_price válido no contrato unificado', { source, productName });
    }
    if (!imageUrl) {
      throw new ProviderValidationError('Item sem image_url no contrato unificado', { source, productName });
    }

    return {
      product_name: productName,
      current_price: currentPrice,
      original_price: originalPrice,
      unit,
      locality_city: isStatewide ? 'São Paulo' : localityCity,
      locality_state: 'SP',
      locality_region: isStatewide ? 'Capital' : localityRegion,
      ddd_code: isStatewide ? 11 : dddCode,
      is_statewide: isStatewide,
      expiry_date: expiryDate,
      image_url: imageUrl,
      metadata: {
        source,
        validity_inferred: validityInferred,
        extraction_strategy: extractionStrategy,
        storePageUrl: context?.storeUrl || context?.metadata?.storePageUrl || null,
        source_url: context?.storeUrl || context?.metadata?.source_url || null,
        flyer_url: context?.metadata?.flyer_url || null,
      },
    };
  }

  /**
   * @param {ProviderResult} result
   * @param {ProviderContext} context
   * @returns {ProviderResult}
   */
  normalizeProviderResult(result, context) {
    if (!result || typeof result !== 'object') {
      throw new ProviderValidationError('Provider retornou resultado inválido', {
        source: this.origem,
      });
    }
    const products = Array.isArray(result.produtos) ? result.produtos : [];
    const normalizedProducts = [];
    for (const item of products) {
      const normalizedItem = this.normalizePayload(item, context, result);
      const validation = validateUnifiedProviderItem(normalizedItem);
      if (!validation.isValid) {
        for (const err of validation.errors) {
          console.error(
            `[Ingest Error] Provider: ${String(this.origem || context?.source || 'unknown')} | Field: ${err.field} | Reason: ${err.reason}`
          );
          pushIngestRejection({
            provider: String(this.origem || context?.source || 'unknown'),
            field: err.field,
            reason: err.reason,
            runId: context?.runId || null,
            productName: normalizedItem?.product_name || null,
          });
        }
        continue;
      }
      normalizedProducts.push(normalizedItem);
    }
    if (normalizedProducts.length === 0) {
      throw new ProviderValidationError('Provider sem produtos válidos após normalização', {
        source: this.origem,
      });
    }
    const first = normalizedProducts[0];
    const anyStatewide = normalizedProducts.some((p) => p.is_statewide);
    return {
      ...result,
      localityScope: anyStatewide ? 'Estadual' : (result.localityScope || 'Cidade'),
      localityCity: anyStatewide ? null : (result.localityCity || first.locality_city),
      localityRegion: anyStatewide ? null : (result.localityRegion || first.locality_region),
      localityState: 'SP',
      dddCode: anyStatewide ? 11 : (result.dddCode ?? first.ddd_code),
      isStatewide: anyStatewide,
      produtos: normalizedProducts,
    };
  }

  /**
   * @param {ProviderContext} context
   * @returns {ProviderResult}
   */
  extract() {
    throw new ProviderValidationError(`extract() não implementado para origem "${this.origem}"`);
  }
}

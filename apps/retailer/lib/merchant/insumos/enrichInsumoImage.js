import { resolveCosmosProductImage, isCosmosConsumerUnavailableError } from '../cosmosConsumerClient';
import { resolveProductImageFromPublicSources } from './resolveProductImage';

const CUSTOM_SOURCES = new Set(['custom', 'lojista', 'upload']);

function isMissingImageColumnError(error) {
  return /imagem_(url|source|atualizada_em)|column .*imagem/i.test(String(error?.message || ''));
}

function cleanImageUrl(value) {
  const url = String(value || '').trim();
  if (!url.startsWith('https://')) return null;
  return url.slice(0, 2048);
}

function isCustomImageSource(source) {
  return CUSTOM_SOURCES.has(String(source || '').toLowerCase());
}

async function persistInsumoImage(
  supabase,
  { lojaId, insumoId, imageUrl, imageSource, category, nowIso }
) {
  const patch = {
    imagem_source: imageSource,
    imagem_atualizada_em: nowIso,
    updated_at: nowIso,
  };

  if (imageUrl) {
    patch.imagem_url = imageUrl;
  } else {
    patch.imagem_url = null;
  }

  if (category) {
    patch.categoria = category;
  }

  const { error } = await supabase
    .from('insumos_loja')
    .update(patch)
    .eq('id', insumoId)
    .eq('loja_id', lojaId);

  if (error) {
    if (isMissingImageColumnError(error)) {
      return { updated: false, skipped: 'missing_columns' };
    }
    console.warn('[insumos/enrich-image]', error.message);
    return { updated: false, error: error.message };
  }

  return {
    updated: true,
    imageUrl: imageUrl || null,
    source: imageSource,
    category: category || null,
  };
}

/**
 * Enriquecimento visual do estoque em camadas:
 * 1. Cosmos (catálogo Bluesoft via consumer)
 * 2. Open Food Facts (EAN)
 * 3. Ícone genérico por palavra-chave no nome (sem URL — UI renderiza ícone)
 *
 * Fotos customizadas (lojista) nunca são sobrescritas.
 */
export async function enrichInsumoImage(
  supabase,
  {
    lojaId,
    insumoId,
    nome,
    ean,
    currentImageUrl = null,
    currentImageSource = null,
    nowIso = new Date().toISOString(),
    force = false,
  }
) {
  if (!insumoId) return { updated: false };

  if (!force && isCustomImageSource(currentImageSource)) {
    return { updated: false, skipped: 'custom' };
  }

  if (!force && cleanImageUrl(currentImageUrl) && currentImageSource !== 'generic') {
    return { updated: false, skipped: 'has_image' };
  }

  // 1. Cosmos
  try {
    const hit = await resolveCosmosProductImage({ gtin: ean, name: nome });
    const cosmosUrl = cleanImageUrl(hit?.imageUrl);
    if (cosmosUrl) {
      return persistInsumoImage(supabase, {
        lojaId,
        insumoId,
        imageUrl: cosmosUrl,
        imageSource: hit.source || 'cosmos',
        category: hit.category || null,
        nowIso,
      });
    }
  } catch (error) {
    if (!isCosmosConsumerUnavailableError(error)) {
      console.warn('[insumos/enrich-image/cosmos]', error?.message || error);
    }
  }

  // 2–3. Open Food Facts → ícone genérico
  const resolved = await resolveProductImageFromPublicSources({ nome, ean });

  return persistInsumoImage(supabase, {
    lojaId,
    insumoId,
    imageUrl: resolved.imageUrl,
    imageSource: resolved.imageSource,
    category: resolved.category,
    nowIso,
  });
}

/** @deprecated Use enrichInsumoImage — mantido para imports existentes */
export async function enrichInsumoImageFromCosmos(
  supabase,
  { lojaId, insumoId, nome, ean, currentImageUrl = null, nowIso = new Date().toISOString() }
) {
  return enrichInsumoImage(supabase, {
    lojaId,
    insumoId,
    nome,
    ean,
    currentImageUrl,
    nowIso,
  });
}

export async function getCurrentInsumoImageUrl(supabase, { lojaId, insumoId }) {
  const { data, error } = await supabase
    .from('insumos_loja')
    .select('imagem_url, imagem_source')
    .eq('id', insumoId)
    .eq('loja_id', lojaId)
    .maybeSingle();

  if (error) {
    if (isMissingImageColumnError(error)) return { available: false, imageUrl: null, imageSource: null };
    console.warn('[insumos/current-image]', error.message);
    return { available: true, imageUrl: null, imageSource: null };
  }

  return {
    available: true,
    imageUrl: data?.imagem_url || null,
    imageSource: data?.imagem_source || null,
  };
}

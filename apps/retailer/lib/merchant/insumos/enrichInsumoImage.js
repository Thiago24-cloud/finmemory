import { resolveCosmosProductImage } from '../../catalog/cosmosApiClient';

function isMissingImageColumnError(error) {
  return /imagem_(url|source|atualizada_em)|column .*imagem/i.test(String(error?.message || ''));
}

function cleanImageUrl(value) {
  const url = String(value || '').trim();
  if (!url.startsWith('https://')) return null;
  return url.slice(0, 2048);
}

/**
 * Enriquecimento visual do estoque: busca imagem no Cosmos por EAN/GTIN ou nome
 * e persiste no insumo para o app listar o estoque com foto.
 */
export async function enrichInsumoImageFromCosmos(
  supabase,
  { lojaId, insumoId, nome, ean, currentImageUrl = null, nowIso = new Date().toISOString() }
) {
  if (!insumoId || cleanImageUrl(currentImageUrl)) return { updated: false };

  const hit = await resolveCosmosProductImage({ gtin: ean, name: nome });
  const imageUrl = cleanImageUrl(hit?.imageUrl);
  if (!imageUrl) return { updated: false };

  const { error } = await supabase
    .from('insumos_loja')
    .update({
      imagem_url: imageUrl,
      imagem_source: hit.source || 'cosmos',
      imagem_atualizada_em: nowIso,
      updated_at: nowIso,
    })
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
    imageUrl,
    source: hit.source || 'cosmos',
    gtin: hit.gtin || null,
  };
}

export async function getCurrentInsumoImageUrl(supabase, { lojaId, insumoId }) {
  const { data, error } = await supabase
    .from('insumos_loja')
    .select('imagem_url')
    .eq('id', insumoId)
    .eq('loja_id', lojaId)
    .maybeSingle();

  if (error) {
    if (isMissingImageColumnError(error)) return { available: false, imageUrl: null };
    console.warn('[insumos/current-image]', error.message);
    return { available: true, imageUrl: null };
  }

  return { available: true, imageUrl: data?.imagem_url || null };
}

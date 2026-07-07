/**
 * Catalog + Match agent: enriquece insumo com nome canônico e termos de busca (Cosmos → heurística).
 */
import {
  fetchCosmosProductByGtin,
  pickBestCosmosProduct,
  searchCosmosProductsByQuery,
} from '../../catalog/cosmosApiClient';
import { normalizeEanDigits } from '../mapInsumoRow';
import { enrichInsumoImageFromCosmos } from '../insumos/enrichInsumoImage';
import {
  buildHeuristicMatchTerms,
  buildMatchTermsFromCosmos,
} from './insumoMatchTerms';

export function isMissingMatchColumnError(error) {
  return /canonical_name|match_termos|match_source|match_atualizado|column .*match/i.test(
    String(error?.message || '')
  );
}

function needsMatchEnrichment(insumo, force) {
  if (force) return true;
  if (!insumo?.canonical_name && !insumo?.match_termos) return true;
  const nome = String(insumo?.nome || '').trim();
  const words = nome.split(/\s+/).filter(Boolean);
  if (words.length <= 1 && nome.length < 12) return true;
  return false;
}

/**
 * @param {{ nome: string, ean?: string|null }} insumo
 */
export async function resolveCatalogMatchForInsumo(insumo) {
  const nome = String(insumo?.nome || '').trim();
  const ean = normalizeEanDigits(insumo?.ean);

  if (ean) {
    const hit = await fetchCosmosProductByGtin(ean);
    if (hit?.name) {
      return {
        canonical_name: hit.name.slice(0, 200),
        match_termos: buildMatchTermsFromCosmos(hit, nome),
        match_source: 'cosmos_gtin',
        ean: hit.gtin || ean,
        cosmos: hit,
      };
    }
  }

  if (nome.length >= 3) {
    const items = await searchCosmosProductsByQuery(nome);
    const best = pickBestCosmosProduct(nome, items);
    if (best?.name) {
      return {
        canonical_name: best.name.slice(0, 200),
        match_termos: buildMatchTermsFromCosmos(best, nome),
        match_source: best.gtin ? 'cosmos_query' : 'cosmos_query',
        ean: best.gtin || ean || null,
        cosmos: best,
      };
    }
  }

  return {
    canonical_name: nome.length >= 2 ? nome.slice(0, 200) : null,
    match_termos: buildHeuristicMatchTerms(nome),
    match_source: 'heuristic',
    ean: ean || null,
    cosmos: null,
  };
}

/**
 * Persiste match no insumo e opcionalmente imagem Cosmos.
 */
export async function enrichInsumoMatchFromCatalog(
  supabase,
  { lojaId, insumoId, nome, ean, canonical_name, match_termos, currentImageUrl, force = false }
) {
  if (!insumoId || !lojaId) return { updated: false };

  const current = {
    nome,
    ean,
    canonical_name,
    match_termos,
  };

  if (!needsMatchEnrichment(current, force)) {
    return { updated: false, skipped: 'already_enriched' };
  }

  const resolved = await resolveCatalogMatchForInsumo(current);
  const nowIso = new Date().toISOString();

  const patch = {
    canonical_name: resolved.canonical_name,
    match_termos: resolved.match_termos,
    match_source: resolved.match_source,
    match_atualizado_em: nowIso,
    updated_at: nowIso,
  };

  if (resolved.ean && !ean) {
    patch.ean = resolved.ean;
  }

  const { error } = await supabase
    .from('insumos_loja')
    .update(patch)
    .eq('id', insumoId)
    .eq('loja_id', lojaId);

  if (error) {
    if (isMissingMatchColumnError(error)) {
      return { updated: false, skipped: 'missing_columns' };
    }
    console.warn('[compras/enrich-match]', error.message);
    return { updated: false, error: error.message };
  }

  let image = null;
  if (!currentImageUrl && resolved.cosmos) {
    image = await enrichInsumoImageFromCosmos(supabase, {
      lojaId,
      insumoId,
      nome: resolved.canonical_name || nome,
      ean: resolved.ean || ean,
      currentImageUrl,
      nowIso,
    });
  }

  return {
    updated: true,
    ...resolved,
    image,
  };
}

/**
 * Enriquece até `limit` insumos da cesta que ainda precisam de match.
 */
export async function enrichCestaInsumosMatch(supabase, lojaId, insumos, { limit = 5, force = false } = {}) {
  const targets = (insumos || [])
    .filter((i) => needsMatchEnrichment(i, force))
    .slice(0, limit);

  const results = [];
  for (const insumo of targets) {
    const r = await enrichInsumoMatchFromCatalog(supabase, {
      lojaId,
      insumoId: insumo.id,
      nome: insumo.nome,
      ean: insumo.ean,
      canonical_name: insumo.canonical_name,
      match_termos: insumo.match_termos,
      currentImageUrl: insumo.imagem_url || insumo.image_url,
      force,
    });
    results.push({ insumoId: insumo.id, ...r });
  }

  return results;
}

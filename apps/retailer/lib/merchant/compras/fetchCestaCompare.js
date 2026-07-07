import { mapInsumoRowToApi } from '../mapInsumoRow';
import { buildCestaCompare } from './cestaCompare';
import { fetchMapOffersForInsumos } from './fetchMapOffersForInsumos';
import { enrichCestaInsumosMatch, isMissingMatchColumnError } from './enrichInsumoMatch';

export const CESTA_INSUMO_SELECT =
  'id, loja_id, nome, sku, ean, categoria, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, status_revisao, imagem_url, imagem_source, na_cesta, cesta_quantidade, cesta_oferta, canonical_name, match_termos, match_source';

export const CESTA_INSUMO_SELECT_NO_MATCH =
  'id, loja_id, nome, sku, ean, categoria, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, status_revisao, imagem_url, imagem_source, na_cesta, cesta_quantidade, cesta_oferta';

export const CESTA_INSUMO_SELECT_NO_CESTA =
  'id, loja_id, nome, sku, ean, categoria, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, status_revisao, imagem_url, imagem_source, canonical_name, match_termos, match_source';

export function isMissingCestaColumnError(error) {
  return /na_cesta|cesta_quantidade|cesta_oferta|column .*cesta/i.test(String(error?.message || ''));
}

export function isMissingImageColumnError(error) {
  return /imagem_(url|source|atualizada_em)|column .*imagem/i.test(String(error?.message || ''));
}

async function fetchCestaInsumos(supabase, lojaId) {
  let query = supabase
    .from('insumos_loja')
    .select(CESTA_INSUMO_SELECT)
    .eq('loja_id', lojaId)
    .eq('na_cesta', true)
    .eq('ativo', true)
    .order('nome', { ascending: true })
    .limit(48);

  let { data, error } = await query;

  if (error && isMissingCestaColumnError(error)) {
    return { insumos: [], cestaAvailable: false, error: null };
  }

  if (error && isMissingImageColumnError(error)) {
    const retry = await supabase
      .from('insumos_loja')
      .select(CESTA_INSUMO_SELECT_NO_MATCH)
      .eq('loja_id', lojaId)
      .eq('na_cesta', true)
      .eq('ativo', true)
      .order('nome', { ascending: true })
      .limit(48);
    data = retry.data;
    error = retry.error;
  }

  if (error && isMissingMatchColumnError(error)) {
    const retry = await supabase
      .from('insumos_loja')
      .select(CESTA_INSUMO_SELECT_NO_MATCH)
      .eq('loja_id', lojaId)
      .eq('na_cesta', true)
      .eq('ativo', true)
      .order('nome', { ascending: true })
      .limit(48);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return { insumos: [], cestaAvailable: true, error };
  }

  return {
    insumos: (data || []).map(mapInsumoRowToApi),
    cestaAvailable: true,
    error: null,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} lojaId
 * @param {{ autoEnrichMatch?: boolean, enrichLimit?: number }} opts
 */
export async function fetchCestaCompareForStore(supabase, lojaId, opts = {}) {
  const { autoEnrichMatch = true, enrichLimit = 5 } = opts;
  let { insumos, cestaAvailable, error } = await fetchCestaInsumos(supabase, lojaId);
  if (error) {
    return { ok: false, error, cestaAvailable };
  }

  let enrichResults = [];
  if (autoEnrichMatch && insumos.length > 0) {
    enrichResults = await enrichCestaInsumosMatch(supabase, lojaId, insumos, {
      limit: enrichLimit,
    });
    const enrichedIds = new Set(
      enrichResults.filter((r) => r.updated).map((r) => r.insumoId)
    );
    if (enrichedIds.size > 0) {
      const refreshed = await fetchCestaInsumos(supabase, lojaId);
      if (!refreshed.error) {
        insumos = refreshed.insumos;
      }
    }
  }

  if (!insumos.length) {
    return {
      ok: true,
      cestaAvailable,
      compare: buildCestaCompare([], []),
      insumos: [],
      enrichResults,
    };
  }

  const mapRows = await fetchMapOffersForInsumos(supabase, insumos);

  return {
    ok: true,
    cestaAvailable,
    insumos,
    enrichResults,
    compare: buildCestaCompare(insumos, mapRows),
  };
}

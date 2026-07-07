import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { mapInsumoRowToApi } from '../../../../lib/merchant/mapInsumoRow';
import {
  CESTA_INSUMO_SELECT,
  fetchCestaCompareForStore,
  isMissingCestaColumnError,
} from '../../../../lib/merchant/compras/fetchCestaCompare';
import {
  enrichInsumoMatchFromCatalog,
  enrichCestaInsumosMatch,
  isMissingMatchColumnError,
} from '../../../../lib/merchant/compras/enrichInsumoMatch';

/**
 * POST /api/merchant/compras/match
 * Body: { insumoId?, insumoIds?, enrichAll?, force? }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;
  const lojaId = store.id;
  const body = req.body || {};
  const force = Boolean(body.force);

  const compareOpts = { autoEnrichMatch: false };

  if (body.enrichAll) {
    const { data: rows, error } = await supabase
      .from('insumos_loja')
      .select(CESTA_INSUMO_SELECT)
      .eq('loja_id', lojaId)
      .eq('na_cesta', true)
      .eq('ativo', true)
      .limit(48);

    if (error) {
      if (isMissingCestaColumnError(error) || isMissingMatchColumnError(error)) {
        return res.status(503).json({ error: 'Migration pendente no Supabase.', code: 'MATCH_MIGRATION_REQUIRED' });
      }
      return res.status(500).json({ error: error.message });
    }

    const insumos = (rows || []).map(mapInsumoRowToApi);
    const enrichResults = await enrichCestaInsumosMatch(supabase, lojaId, insumos, {
      limit: 48,
      force,
    });

    const refreshed = await fetchCestaCompareForStore(supabase, lojaId, compareOpts);
    if (!refreshed.ok) {
      return res.status(500).json({ error: 'Match aplicado, mas falhou ao recarregar cesta.' });
    }

    return res.status(200).json({
      enrichResults,
      insumos: refreshed.insumos,
      ...refreshed.compare,
    });
  }

  const ids = [];
  if (body.insumoId || body.insumo_id) {
    ids.push(String(body.insumoId || body.insumo_id).trim());
  }
  if (Array.isArray(body.insumoIds)) {
    for (const id of body.insumoIds) {
      const s = String(id || '').trim();
      if (s) ids.push(s);
    }
  }

  if (ids.length === 0) {
    return res.status(400).json({ error: 'Informe insumoId, insumoIds ou enrichAll.' });
  }

  const enrichResults = [];
  for (const insumoId of [...new Set(ids)].slice(0, 12)) {
    const { data: row, error } = await supabase
      .from('insumos_loja')
      .select(CESTA_INSUMO_SELECT)
      .eq('id', insumoId)
      .eq('loja_id', lojaId)
      .maybeSingle();

    if (error) {
      if (isMissingMatchColumnError(error)) {
        return res.status(503).json({ error: 'Migration de match pendente.', code: 'MATCH_MIGRATION_REQUIRED' });
      }
      return res.status(500).json({ error: error.message });
    }
    if (!row) {
      enrichResults.push({ insumoId, updated: false, error: 'not_found' });
      continue;
    }

    const insumo = mapInsumoRowToApi(row);
    const result = await enrichInsumoMatchFromCatalog(supabase, {
      lojaId,
      insumoId,
      nome: insumo.nome,
      ean: insumo.ean,
      canonical_name: insumo.canonical_name,
      match_termos: insumo.match_termos,
      currentImageUrl: insumo.imagem_url,
      force,
    });
    enrichResults.push({ insumoId, ...result });
  }

  const refreshed = await fetchCestaCompareForStore(supabase, lojaId, compareOpts);
  if (!refreshed.ok) {
    return res.status(500).json({ error: 'Match aplicado, mas falhou ao recarregar cesta.' });
  }

  return res.status(200).json({
    enrichResults,
    insumos: refreshed.insumos,
    ...refreshed.compare,
  });
}

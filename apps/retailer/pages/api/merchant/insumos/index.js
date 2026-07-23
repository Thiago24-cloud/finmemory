import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { requireFeature } from '../../../../lib/merchant/requireFeature';
import {
  mapInsumoRowToApi,
  normalizeEanDigits,
  normalizeInsumoUnidade,
} from '../../../../lib/merchant/mapInsumoRow';
import { enrichInsumoImage } from '../../../../lib/merchant/insumos/enrichInsumoImage';
import { computeInsumoImageStats } from '../../../../lib/merchant/insumoImageStats';

const INSUMO_SELECT =
  'id, loja_id, nome, sku, ean, categoria, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, status_revisao, import_lote_id, imagem_url, imagem_source, imagem_atualizada_em, na_cesta, cesta_quantidade, cesta_oferta, canonical_name, match_termos, match_source, match_atualizado_em, created_at, updated_at';
const INSUMO_SELECT_FALLBACK =
  'id, loja_id, nome, sku, ean, categoria, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, status_revisao, import_lote_id, imagem_url, imagem_source, imagem_atualizada_em, na_cesta, cesta_quantidade, cesta_oferta, created_at, updated_at';
const INSUMO_SELECT_MINIMAL =
  'id, loja_id, nome, sku, ean, categoria, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, status_revisao, import_lote_id, created_at, updated_at';

function isMissingTableError(error) {
  return /insumos_loja/i.test(String(error?.message || ''));
}

function isMissingCestaColumnError(error) {
  return /na_cesta|cesta_quantidade|cesta_oferta|column .*cesta/i.test(String(error?.message || ''));
}

function isMissingMatchColumnError(error) {
  return /canonical_name|match_termos|match_source|match_atualizado|column .*match/i.test(
    String(error?.message || '')
  );
}

function isMissingImageColumnError(error) {
  return /imagem_(url|source|atualizada_em)|column .*imagem/i.test(String(error?.message || ''));
}

function cleanImageUrl(value) {
  const url = String(value || '').trim();
  return url.startsWith('https://') ? url.slice(0, 2048) : null;
}

/**
 * GET  /api/merchant/insumos — insumos da loja (matéria-prima)
 * POST /api/merchant/insumos — cadastra insumo
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;
  if (!(await requireFeature(auth, res, 'inventory_control'))) return;

  const { supabase, store } = auth;
  const lojaId = store.id;

  if (req.method === 'GET') {
    const includeInactive = req.query?.include_inactive === '1';
    const includePending = req.query?.include_pending === '1';
    let query = supabase
      .from('insumos_loja')
      .select(INSUMO_SELECT)
      .eq('loja_id', lojaId)
      .order('nome', { ascending: true })
      .limit(500);

    if (includePending) {
      query = query.in('status_revisao', ['aprovado', 'pendente']);
    } else if (!includeInactive) {
      query = query.eq('ativo', true);
    }

    let { data, error } = await query;

    if (error && (isMissingImageColumnError(error) || isMissingCestaColumnError(error) || isMissingMatchColumnError(error))) {
      query = supabase
        .from('insumos_loja')
        .select(INSUMO_SELECT_FALLBACK)
        .eq('loja_id', lojaId)
        .order('nome', { ascending: true })
        .limit(500);

      if (includePending) {
        query = query.in('status_revisao', ['aprovado', 'pendente']);
      } else if (!includeInactive) {
        query = query.eq('ativo', true);
      }

      let retry = await query;
      if (retry.error && isMissingImageColumnError(retry.error)) {
        query = supabase
          .from('insumos_loja')
          .select(INSUMO_SELECT_MINIMAL)
          .eq('loja_id', lojaId)
          .order('nome', { ascending: true })
          .limit(500);

        if (includePending) {
          query = query.in('status_revisao', ['aprovado', 'pendente']);
        } else if (!includeInactive) {
          query = query.eq('ativo', true);
        }
        retry = await query;
      }
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (isMissingTableError(error)) {
        return res.status(503).json({
          error:
            'Tabela insumos_loja ainda não existe. Execute supabase/run-insumos-loja-migration.sql no Supabase.',
        });
      }
      return res.status(500).json({ error: error.message });
    }

    const insumos = (data || []).map(mapInsumoRowToApi);
    const ativos = insumos.filter((i) => i.ativo);
    const abaixoMinimo = insumos.filter((i) => i.abaixo_minimo && i.ativo).length;
    const pendenteRevisao = insumos.filter((i) => i.status_revisao === 'pendente').length;
    const imageStats = computeInsumoImageStats(ativos);
    const totalUnits = ativos.reduce((sum, i) => sum + (Number(i.quantidade_atual) || 0), 0);

    return res.status(200).json({
      insumos,
      store_id: lojaId,
      loja_id: lojaId,
      total: ativos.length,
      abaixo_minimo: abaixoMinimo,
      pendente_revisao: pendenteRevisao,
      summary: {
        totalProducts: ativos.length,
        totalUnits: Math.round(totalUnits * 1000) / 1000,
        lowStockCount: abaixoMinimo,
        imageStats,
      },
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const nome = String(body.nome || body.name || '').trim().slice(0, 200);
    const ean = normalizeEanDigits(body.ean || body.gtin);
    const unidade = normalizeInsumoUnidade(body.unidade);
    const estoqueMinimo = Number(body.estoque_minimo ?? body.estoqueMinimo ?? 0);
    const quantidadeAtual = Number(body.quantidade_atual ?? body.quantidadeAtual ?? 0);
    const custoMedioRaw = body.custo_medio ?? body.custoMedio;
    const custoMedio =
      custoMedioRaw != null && custoMedioRaw !== '' ? Number(custoMedioRaw) : null;
    const recorrente = body.recorrente !== false;
    const imagemUrl = cleanImageUrl(body.imagem_url || body.image_url || body.imageUrl);
    const imagemSource =
      imagemUrl && body.imagem_source ? String(body.imagem_source).trim().slice(0, 80) : null;

    if (!nome || nome.length < 2) {
      return res.status(400).json({ error: 'Informe o nome do insumo.' });
    }
    if (!Number.isFinite(estoqueMinimo) || estoqueMinimo < 0) {
      return res.status(400).json({ error: 'Estoque mínimo inválido.' });
    }
    if (!Number.isFinite(quantidadeAtual) || quantidadeAtual < 0) {
      return res.status(400).json({ error: 'Quantidade atual inválida.' });
    }
    if (custoMedio != null && (!Number.isFinite(custoMedio) || custoMedio < 0)) {
      return res.status(400).json({ error: 'Custo médio inválido.' });
    }

    if (ean) {
      const { data: dup } = await supabase
        .from('insumos_loja')
        .select('id')
        .eq('loja_id', lojaId)
        .eq('ean', ean)
        .eq('ativo', true)
        .maybeSingle();
      if (dup?.id) {
        return res.status(409).json({ error: 'Já existe um insumo ativo com este código de barras.' });
      }
    }

    const nowIso = new Date().toISOString();
    const insertPayload = {
      loja_id: lojaId,
      nome,
      ean,
      unidade,
      estoque_minimo: Math.round(estoqueMinimo * 1000) / 1000,
      quantidade_atual: Math.round(quantidadeAtual * 1000) / 1000,
      custo_medio: custoMedio != null ? Math.round(custoMedio * 100) / 100 : null,
      recorrente,
      ativo: true,
      status_revisao: 'aprovado',
      updated_at: nowIso,
    };

    if (imagemUrl) {
      insertPayload.imagem_url = imagemUrl;
      insertPayload.imagem_source = imagemSource || 'cosmos';
      insertPayload.imagem_atualizada_em = nowIso;
    }

    let { data: row, error: insErr } = await supabase
      .from('insumos_loja')
      .insert(insertPayload)
      .select(INSUMO_SELECT)
      .single();

    if (insErr && isMissingImageColumnError(insErr)) {
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.imagem_url;
      delete fallbackPayload.imagem_source;
      delete fallbackPayload.imagem_atualizada_em;
      const retry = await supabase
        .from('insumos_loja')
        .insert(fallbackPayload)
        .select(INSUMO_SELECT_FALLBACK)
        .single();
      row = retry.data;
      insErr = retry.error;
    }

    if (insErr) {
      if (isMissingTableError(insErr)) {
        return res.status(503).json({
          error: 'Tabela insumos_loja ainda não existe. Execute a migração no Supabase.',
        });
      }
      return res.status(500).json({ error: insErr.message });
    }

    await enrichInsumoImage(supabase, {
      lojaId,
      insumoId: row.id,
      nome: row.nome,
      ean: row.ean,
      currentImageUrl: row.imagem_url,
      currentImageSource: row.imagem_source,
      nowIso,
    }).catch(() => {});

    const { data: enriched } = await supabase
      .from('insumos_loja')
      .select(INSUMO_SELECT)
      .eq('id', row.id)
      .maybeSingle();

    return res.status(201).json({ insumo: mapInsumoRowToApi(enriched || row) });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

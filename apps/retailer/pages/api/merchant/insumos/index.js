import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import {
  mapInsumoRowToApi,
  normalizeEanDigits,
  normalizeInsumoUnidade,
} from '../../../../lib/merchant/mapInsumoRow';

function isMissingTableError(error) {
  return /insumos_loja/i.test(String(error?.message || ''));
}

/**
 * GET  /api/merchant/insumos — insumos da loja (matéria-prima)
 * POST /api/merchant/insumos — cadastra insumo
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;
  const lojaId = store.id;

  if (req.method === 'GET') {
    const includeInactive = req.query?.include_inactive === '1';
    let query = supabase
      .from('insumos_loja')
      .select(
        'id, loja_id, nome, ean, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, created_at, updated_at'
      )
      .eq('loja_id', lojaId)
      .order('nome', { ascending: true })
      .limit(500);

    if (!includeInactive) {
      query = query.eq('ativo', true);
    }

    const { data, error } = await query;

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
    const abaixoMinimo = insumos.filter((i) => i.abaixo_minimo).length;

    return res.status(200).json({
      insumos,
      store_id: lojaId,
      loja_id: lojaId,
      total: insumos.length,
      abaixo_minimo: abaixoMinimo,
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
    const { data: row, error: insErr } = await supabase
      .from('insumos_loja')
      .insert({
        loja_id: lojaId,
        nome,
        ean,
        unidade,
        estoque_minimo: Math.round(estoqueMinimo * 1000) / 1000,
        quantidade_atual: Math.round(quantidadeAtual * 1000) / 1000,
        custo_medio: custoMedio != null ? Math.round(custoMedio * 100) / 100 : null,
        recorrente,
        ativo: true,
        updated_at: nowIso,
      })
      .select(
        'id, loja_id, nome, ean, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, created_at, updated_at'
      )
      .single();

    if (insErr) {
      if (isMissingTableError(insErr)) {
        return res.status(503).json({
          error: 'Tabela insumos_loja ainda não existe. Execute a migração no Supabase.',
        });
      }
      return res.status(500).json({ error: insErr.message });
    }

    return res.status(201).json({ insumo: mapInsumoRowToApi(row) });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

import { mapInsumoRowToApi } from '../mapInsumoRow';

const INSUMO_SELECT =
  'id, loja_id, nome, sku, ean, categoria, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, status_revisao, import_lote_id, created_at, updated_at';

function parseDelta(direction, delta) {
  const step = Number(delta);
  if (!Number.isFinite(step) || step <= 0) {
    return { error: { status: 'invalid_delta', message: 'Quantidade inválida.' } };
  }
  const sign = direction === 'out' ? -1 : 1;
  return { appliedDelta: sign * step };
}

/**
 * Aplica delta de estoque a um insumo já identificado (visão / ID).
 */
export async function applyStockDelta(supabase, { lojaId, insumoId, direction, delta = 1 }) {
  const parsed = parseDelta(direction, delta);
  if (parsed.error) return parsed.error;

  const { data: insumo, error: fetchErr } = await supabase
    .from('insumos_loja')
    .select(INSUMO_SELECT)
    .eq('id', insumoId)
    .eq('loja_id', lojaId)
    .eq('ativo', true)
    .in('status_revisao', ['aprovado', 'pendente'])
    .maybeSingle();

  if (fetchErr) {
    if (/insumos_loja/i.test(String(fetchErr.message || ''))) {
      return { status: 'table_missing', message: fetchErr.message };
    }
    throw fetchErr;
  }
  if (!insumo) return { status: 'not_found', insumoId };

  return commitStockUpdate(supabase, {
    lojaId,
    insumo,
    appliedDelta: parsed.appliedDelta,
    direction,
  });
}

export async function commitStockUpdate(supabase, { lojaId, insumo, appliedDelta, direction, ean }) {
  const current = Number(insumo.quantidade_atual) || 0;
  const next = Math.round((current + appliedDelta) * 1000) / 1000;

  if (next < 0) {
    return {
      status: 'insufficient_stock',
      ean: ean ?? insumo.ean,
      insumo: mapInsumoRowToApi(insumo),
      quantidade_atual: current,
    };
  }

  const { data: updated, error: updErr } = await supabase
    .from('insumos_loja')
    .update({
      quantidade_atual: next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', insumo.id)
    .eq('loja_id', lojaId)
    .select(INSUMO_SELECT)
    .single();

  if (updErr) throw updErr;

  return {
    status: 'ok',
    ean: ean ?? insumo.ean ?? null,
    insumoId: insumo.id,
    appliedDelta,
    direction,
    insumo: mapInsumoRowToApi(updated),
  };
}

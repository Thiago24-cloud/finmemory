import { normalizeEanDigits } from '../mapInsumoRow';
import { commitStockUpdate } from './applyStockDelta';

const INSUMO_SELECT =
  'id, loja_id, nome, sku, ean, categoria, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, status_revisao, import_lote_id, created_at, updated_at';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ lojaId: string, ean: string, direction: 'in' | 'out', delta?: number }} input
 */
export async function scanStockByBarcode(supabase, { lojaId, ean, direction, delta = 1 }) {
  const digits = normalizeEanDigits(ean);
  if (!digits) {
    return { status: 'invalid_ean', message: 'Código de barras inválido.' };
  }

  const step = Number(delta);
  if (!Number.isFinite(step) || step <= 0) {
    return { status: 'invalid_delta', message: 'Quantidade inválida.' };
  }

  const sign = direction === 'out' ? -1 : 1;
  const appliedDelta = sign * step;

  const { data: insumo, error: fetchErr } = await supabase
    .from('insumos_loja')
    .select(INSUMO_SELECT)
    .eq('loja_id', lojaId)
    .eq('ean', digits)
    .eq('ativo', true)
    .in('status_revisao', ['aprovado', 'pendente'])
    .maybeSingle();

  if (fetchErr) {
    if (/insumos_loja/i.test(String(fetchErr.message || ''))) {
      return { status: 'table_missing', message: fetchErr.message };
    }
    throw fetchErr;
  }

  if (!insumo) {
    return { status: 'not_found', ean: digits };
  }

  return commitStockUpdate(supabase, {
    lojaId,
    insumo,
    appliedDelta,
    direction,
    ean: digits,
  });
}

export { applyStockDelta } from './applyStockDelta';

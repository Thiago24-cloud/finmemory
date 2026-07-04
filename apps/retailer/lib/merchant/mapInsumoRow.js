/** @param {Record<string, unknown>} row */
export function mapInsumoRowToApi(row) {
  if (!row) return null;
  const qty = Number(row.quantidade_atual);
  const min = Number(row.estoque_minimo);
  return {
    id: row.id,
    loja_id: row.loja_id,
    nome: row.nome,
    sku: row.sku || null,
    ean: row.ean || null,
    categoria: row.categoria || null,
    unidade: row.unidade || 'un',
    estoque_minimo: min,
    quantidade_atual: qty,
    custo_medio: row.custo_medio != null ? Number(row.custo_medio) : null,
    recorrente: Boolean(row.recorrente),
    ativo: row.ativo !== false,
    status_revisao: row.status_revisao || 'aprovado',
    import_lote_id: row.import_lote_id || null,
    imagem_url: row.imagem_url || null,
    image_url: row.imagem_url || null,
    imagem_source: row.imagem_source || null,
    imagem_atualizada_em: row.imagem_atualizada_em || null,
    abaixo_minimo: Number.isFinite(qty) && Number.isFinite(min) && min > 0 && qty <= min,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const INSUMO_UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'dz'];

export function normalizeInsumoUnidade(raw) {
  const u = String(raw || 'un').trim().toLowerCase();
  if (INSUMO_UNIDADES.includes(u)) return u;
  if (u === 'l') return 'L';
  return 'un';
}

export function normalizeEanDigits(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

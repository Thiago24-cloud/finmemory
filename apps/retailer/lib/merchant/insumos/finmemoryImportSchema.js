/** Campos padrão FinMemory para importação de insumos (CSV/ERP). */
export const FINMEMORY_IMPORT_FIELDS = [
  { key: 'nome', label: 'Nome do insumo', required: true },
  { key: 'sku', label: 'SKU / código interno', required: false },
  { key: 'ean', label: 'Código de barras (EAN/GTIN)', required: false },
  { key: 'categoria', label: 'Categoria', required: false },
  { key: 'unidade', label: 'Unidade (un, kg, L…)', required: false },
  { key: 'quantidade_atual', label: 'Quantidade em estoque', required: false },
  { key: 'custo_medio', label: 'Custo médio (R$)', required: false },
  { key: 'estoque_minimo', label: 'Estoque mínimo', required: false },
];

const HEADER_ALIASES = {
  nome: ['nome', 'name', 'produto', 'descricao', 'descrição', 'item', 'insumo'],
  sku: ['sku', 'codigo', 'código', 'cod', 'cod_interno', 'referencia', 'ref'],
  ean: ['ean', 'gtin', 'barcode', 'codigo_barras', 'código_barras'],
  categoria: ['categoria', 'category', 'grupo', 'departamento', 'familia', 'família'],
  unidade: ['unidade', 'unit', 'um', 'medida'],
  quantidade_atual: ['quantidade', 'qtd', 'estoque', 'saldo', 'quantidade_atual', 'qty'],
  custo_medio: ['custo', 'custo_medio', 'preco_custo', 'preço_custo', 'valor_unitario', 'custo_unitario'],
  estoque_minimo: ['estoque_minimo', 'minimo', 'mínimo', 'est_min'],
};

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_');
}

/**
 * Sugere mapeamento coluna CSV → campo FinMemory.
 * @param {string[]} headers
 * @returns {Record<string, string|null>}
 */
export function suggestColumnMapping(headers) {
  const mapping = {};
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));

  for (const field of FINMEMORY_IMPORT_FIELDS) {
    const aliases = HEADER_ALIASES[field.key] || [field.key];
    const match = normalized.find(({ norm }) => aliases.some((a) => norm === normalizeHeader(a)));
    mapping[field.key] = match ? match.raw : null;
  }
  return mapping;
}

export { normalizeHeader };

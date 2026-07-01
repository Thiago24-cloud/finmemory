/** Normaliza venda + itens do Supabase para a API do painel. */
export function mapVendaItemRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    produto_loja_id: row.produto_loja_id,
    produtoId: row.produto_loja_id,
    nome_produto: row.nome_produto,
    nomeProduto: row.nome_produto,
    preco_unitario: row.preco_unitario,
    precoUnitario: String(row.preco_unitario),
    quantidade: row.quantidade,
    subtotal: String(row.subtotal),
  };
}

export function mapVendaRow(row, items = []) {
  if (!row) return null;
  const createdAt = row.vendido_em || row.created_at;
  return {
    id: row.id,
    loja_id: row.loja_id,
    external_ref: row.external_ref,
    externalRef: row.external_ref,
    terminal: row.terminal,
    bandeira: row.bandeira,
    valor_total: row.valor_total,
    valorTotal: String(row.valor_total),
    metodo: row.metodo,
    status: row.status,
    created_at: createdAt,
    createdAt: createdAt ? new Date(createdAt).toISOString() : null,
    items: items.map(mapVendaItemRow).filter(Boolean),
  };
}

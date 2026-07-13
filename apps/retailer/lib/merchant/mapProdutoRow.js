/** Normaliza linha public.produtos para o painel web (campos em inglês legados). */
export function mapProdutoRowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    store_id: row.loja_id,
    loja_id: row.loja_id,
    name: row.nome,
    nome: row.nome,
    description: row.descricao,
    descricao: row.descricao,
    ingredients: row.ingredientes || null,
    ingredientes: row.ingredientes || null,
    price: row.preco_oferta,
    preco_oferta: row.preco_oferta,
    preco_original: row.preco_original,
    em_oferta: row.em_oferta,
    quantidade_estoque: row.quantidade_estoque,
    image_url: row.url_imagem,
    url_imagem: row.url_imagem,
    image_optimized_url: row.image_optimized_url || null,
    ean: row.ean || null,
    categoria: row.categoria || null,
    imagem_source: row.imagem_source || null,
    insumo_id: row.insumo_id || null,
    active: row.status_disponivel,
    status_disponivel: row.status_disponivel,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

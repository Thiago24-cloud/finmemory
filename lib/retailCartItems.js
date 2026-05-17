/**
 * Converte linhas do carrinho do scanner em itens de inventário varejista.
 * @param {Array<{ gtin: string, apiOk?: boolean, payload?: object }>} cart
 */
export function cartRowsToRetailInventoryLines(cart) {
  return (cart || [])
    .filter((row) => row?.gtin)
    .map((row) => {
      const ph = row.payload?.priceHints;
      const precoRaw =
        ph?.referencePrice != null
          ? Number(ph.referencePrice)
          : ph?.bestPrice != null
            ? Number(ph.bestPrice)
            : null;
      const preco =
        precoRaw != null && Number.isFinite(precoRaw) ? precoRaw : null;
      const nome =
        row.payload?.openFoodFacts?.name?.trim() ||
        row.payload?.productName?.trim() ||
        'Produto';
      return {
        ean: String(row.gtin),
        nome,
        quantidade: 1,
        preco,
      };
    });
}

/**
 * @param {ReturnType<typeof cartRowsToRetailInventoryLines>} lines
 */
export function sumRetailInventoryLines(lines) {
  let valorTotal = 0;
  let priced = 0;
  for (const line of lines) {
    if (line.preco != null && Number.isFinite(line.preco)) {
      valorTotal += line.preco * (line.quantidade || 1);
      priced += 1;
    }
  }
  return {
    totalItens: lines.length,
    valorTotal: Math.round(valorTotal * 100) / 100,
    pricedCount: priced,
  };
}

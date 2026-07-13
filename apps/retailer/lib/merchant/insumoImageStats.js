/** Agrupa contagem de imagens por origem (insumos_loja). */
export function computeInsumoImageStats(insumos) {
  const stats = {
    openfoodfacts: 0,
    cosmos: 0,
    generic: 0,
    custom: 0,
    none: 0,
  };

  for (const insumo of insumos || []) {
    if (!insumo.ativo) continue;
    const source = String(insumo.imagem_source || '').toLowerCase();
    const hasUrl = Boolean(insumo.imagem_url || insumo.image_url);

    if (source === 'openfoodfacts') {
      stats.openfoodfacts++;
    } else if (source === 'cosmos' || source === 'bluesoft') {
      stats.cosmos++;
    } else if (source === 'generic' || (!hasUrl && source === '')) {
      stats.generic++;
    } else if (['custom', 'lojista', 'upload'].includes(source)) {
      stats.custom++;
    } else if (hasUrl) {
      stats.custom++;
    } else {
      stats.none++;
    }
  }

  return stats;
}

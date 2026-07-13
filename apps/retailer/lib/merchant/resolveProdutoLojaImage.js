import { resolveProductImageFromPublicSources } from './insumos/resolveProductImage';
import { matchCategoryByName } from './insumos/productCategories';
import { resolveOptimizedProductImage } from './optimizedProductImage';

const CUSTOM_SOURCES = new Set(['custom', 'lojista', 'upload']);

function isCustomSource(source) {
  return CUSTOM_SOURCES.has(String(source || '').toLowerCase());
}

/**
 * Resolve imagem para produtos_loja (ofertas):
 * 1. Mantém custom se já definido (a menos que forceRefresh)
 * 2. Open Food Facts pelo EAN
 * 3. Busca Google CSE por nome (fallback premium)
 * 4. Ícone genérico por categoria (sem URL)
 */
export async function resolveProdutoLojaImage({
  nome,
  ean = null,
  imageUrl = null,
  imagemSource = null,
  forceRefresh = false,
}) {
  const category = matchCategoryByName(nome);

  if (!forceRefresh && isCustomSource(imagemSource) && imageUrl) {
    const opt = await resolveOptimizedProductImage({
      productName: nome,
      imageUrl,
      allowSearchByName: false,
    });
    return {
      url_imagem: imageUrl,
      imagem_source: 'custom',
      categoria: category,
      image_optimized_url: opt.optimizedUrl,
    };
  }

  const fromPublic = await resolveProductImageFromPublicSources({ nome, ean });
  if (fromPublic.imageUrl) {
    const opt = await resolveOptimizedProductImage({
      productName: nome,
      imageUrl: fromPublic.imageUrl,
      allowSearchByName: false,
    });
    return {
      url_imagem: fromPublic.imageUrl,
      imagem_source: fromPublic.imageSource,
      categoria: fromPublic.category || category,
      image_optimized_url: opt.optimizedUrl,
    };
  }

  const opt = await resolveOptimizedProductImage({
    productName: nome,
    imageUrl: forceRefresh ? null : imageUrl,
    allowSearchByName: true,
  });

  if (opt.sourceUrl) {
    return {
      url_imagem: opt.sourceUrl,
      imagem_source: 'google',
      categoria: fromPublic.category || category,
      image_optimized_url: opt.optimizedUrl,
    };
  }

  return {
    url_imagem: null,
    imagem_source: fromPublic.imageSource || 'generic',
    categoria: fromPublic.category || category,
    image_optimized_url: null,
  };
}

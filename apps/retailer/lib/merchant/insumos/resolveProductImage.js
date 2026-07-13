import { matchCategoryByName } from './productCategories';

const OPEN_FOOD_FACTS_TIMEOUT_MS = 5000;

/**
 * Busca foto real na API pública Open Food Facts pelo código de barras.
 * @param {string} barcode
 * @returns {Promise<string|null>}
 */
export async function lookupOpenFoodFactsImage(barcode) {
  const code = String(barcode || '').replace(/\D/g, '');
  if (!code) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPEN_FOOD_FACTS_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'FinMemory/1.0 (https://finmemory.com.br; estoque-lojista)',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const imageUrl = data?.product?.image_url ?? data?.product?.image_front_url;

    if (data?.status === 1 && imageUrl) {
      return String(imageUrl).trim();
    }

    return null;
  } catch (error) {
    console.warn('[insumos/openfoodfacts]', error?.message || error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve imagem do produto em 3 níveis (sem Cosmos):
 * 1. Open Food Facts pelo EAN
 * 2. Ícone genérico por palavra-chave no nome (sem URL)
 * @param {{ nome: string, ean?: string|null }} input
 */
export async function resolveProductImageFromPublicSources({ nome, ean }) {
  const category = matchCategoryByName(nome);

  if (ean) {
    const imageUrl = await lookupOpenFoodFactsImage(ean);
    if (imageUrl) {
      return { category, imageSource: 'openfoodfacts', imageUrl };
    }
  }

  return { category, imageSource: 'generic', imageUrl: null };
}

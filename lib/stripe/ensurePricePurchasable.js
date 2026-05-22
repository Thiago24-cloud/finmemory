/**
 * Garante que price + product Stripe estão ativos antes de abrir o Checkout.
 * Corrige catálogo arquivado no Dashboard (erro "product is not active").
 */

/**
 * @param {import('stripe').Stripe} stripe
 * @param {string} priceId
 * @returns {Promise<import('stripe').Stripe.Price>}
 */
export async function ensureStripePricePurchasable(stripe, priceId) {
  let price = await stripe.prices.retrieve(priceId, { expand: ['product'] });

  const productRef = price.product;
  const productId =
    typeof productRef === 'string' ? productRef : productRef?.id || null;
  const productObj = typeof productRef === 'object' && productRef ? productRef : null;

  if (productId && productObj && !productObj.active) {
    await stripe.products.update(productId, { active: true });
  }
  if (!price.active) {
    await stripe.prices.update(priceId, { active: true });
  }

  price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
  const prodAfter = typeof price.product === 'object' ? price.product : null;

  if (!price.active) {
    const err = new Error(
      `Preço ${priceId} está inativo no Stripe. Dashboard → Products → ative o preço.`
    );
    err.code = 'price_inactive';
    throw err;
  }
  if (prodAfter && !prodAfter.active) {
    const err = new Error(
      `Produto "${prodAfter.name || productId}" inativo no Stripe. Dashboard → Products → ative o produto do plano.`
    );
    err.code = 'product_inactive';
    throw err;
  }

  return price;
}

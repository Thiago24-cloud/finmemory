/**
 * Slug Simple Icons (cdn.simpleicons.org) para logo da instituição.
 * @param {string | undefined} name — display_name ou name da conta Pluggy
 * @returns {string | null}
 */
export function getBankSimpleIconSlug(name) {
  const n = String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

  if (n.includes('nubank')) return 'nubank';
  if (n.includes('c6')) return 'c6bank';
  if (n.includes('picpay')) return 'picpay';
  if (n.includes('bradesco')) return 'bradesco';
  if (n.includes('itau') || n.includes('itaú')) return 'itau';
  if (n.includes('inter')) return 'inter';
  if (n.includes('santander')) return 'santander';
  if (n.includes('banco do brasil') || n.includes('banco brasil')) return 'bancodobrasil';
  if (n.includes('caixa')) return 'caixa';
  if (n.includes('sicredi')) return 'sicredi';
  if (n.includes('sicoob')) return 'sicoob';
  if (n.includes('mercado pago') || n.includes('mercadopago')) return 'mercadopago';
  if (n.includes('pagbank') || n.includes('pag seguro')) return 'pagseguro';
  return null;
}

/**
 * URL de logo monocromática (branca) para fundos coloridos.
 * @param {string | undefined} name
 * @returns {string | null}
 */
export function getBankLogoUrlWhite(name) {
  const slug = getBankSimpleIconSlug(name);
  if (!slug) return null;
  return `https://cdn.simpleicons.org/${slug}/ffffff`;
}

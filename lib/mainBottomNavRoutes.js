/**
 * Rotas que usam a BottomNav principal renderizada uma única vez em `_app`
 * (`AppMainBottomNav`), para não remontar o FAB a cada navegação.
 * Não incluir login, admin, shopping-list (nav própria), landing estática, etc.
 */
const MAIN_BOTTOM_NAV_EXACT = new Set([
  '/dashboard',
  '/mapa',
  '/settings',
  '/missoes',
  '/add-receipt',
  '/scan-product',
  '/planos',
  '/partnership',
  '/share-price',
  '/calculadora',
  '/simulador',
  '/cartoes',
  '/manual-entry',
  '/listas',
  '/notifications',
]);

export function showMainBottomNav(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  return MAIN_BOTTOM_NAV_EXACT.has(pathname);
}

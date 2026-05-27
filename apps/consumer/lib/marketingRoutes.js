/** Rotas institucionais / marketing — sem splash, mapa, missões ou bottom nav. */

const EXACT = new Set([
  '/',
  '/termos',
  '/privacidade',
  '/download',
  '/em-breve',
  '/login',
]);

export function isPublicMarketingPage(pathname) {
  return Boolean(pathname && typeof pathname === 'string' && EXACT.has(pathname));
}

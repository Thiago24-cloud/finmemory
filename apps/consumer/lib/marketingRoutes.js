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
  if (!pathname || typeof pathname !== 'string') return false;
  if (EXACT.has(pathname)) return true;
  if (pathname.startsWith('/loja/')) return true;
  return false;
}

/** Rotas institucionais / marketing — sem splash, mapa, missões ou bottom nav. */

const EXACT = new Set([
  '/',
  '/parceiros',
  '/termos',
  '/privacidade',
  '/download',
  '/em-breve',
  '/login',
]);

export function isPublicMarketingPage(pathname) {
  return Boolean(pathname && typeof pathname === 'string' && EXACT.has(pathname));
}

export function isMerchantPanelPage(pathname) {
  return pathname === '/parceiros/painel';
}

/** Rotas do ecossistema Parceiros — não redirecionar para /escolher-perfil. */
export function isPartnerRoute(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  return pathname === '/parceiros' || pathname.startsWith('/parceiros/');
}

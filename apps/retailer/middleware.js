import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getPrivateBetaAllowlistFromEnv, isEmailAllowedInPrivateBeta } from './lib/privateBetaAllowlist';

function shouldForceHttps(req) {
  if (process.env.NODE_ENV !== 'production') return false;
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  if (!host || host === 'localhost' || host === '127.0.0.1') return false;
  const proto = (req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', ''))
    .split(',')[0]
    .trim()
    .toLowerCase();
  return proto === 'http';
}

function httpsRedirect(req) {
  const url = req.nextUrl.clone();
  url.protocol = 'https:';
  return NextResponse.redirect(url, 308);
}

function isPublicApiPath(pathname) {
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname.startsWith('/api/partners/')) return true;
  if (pathname.startsWith('/api/parceiros/painel/')) return true;
  if (pathname.startsWith('/api/merchant/')) return true;
  if (pathname.startsWith('/api/varejo/')) return true;
  if (pathname === '/api/user/account-type') return true;
  return false;
}

function isPublicPagePath(pathname) {
  if (pathname === '/') return true;
  if (pathname.startsWith('/login')) return true;
  if (pathname.startsWith('/parceiros')) return true;
  if (pathname.startsWith('/escolher-perfil')) return true;
  return false;
}

function isPublicStaticAsset(pathname) {
  return /\.(?:svg|png|jpe?g|gif|webp|ico|woff2?|txt|xml|json)$/i.test(pathname);
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (shouldForceHttps(req)) return httpsRedirect(req);

  if (isPublicStaticAsset(pathname)) return NextResponse.next();

  const allowlist = getPrivateBetaAllowlistFromEnv();
  if (!allowlist) return NextResponse.next();

  if (pathname.startsWith('/_next')) return NextResponse.next();

  if (pathname.startsWith('/api')) {
    if (isPublicApiPath(pathname)) return NextResponse.next();
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.next();
    if (isEmailAllowedInPrivateBeta(token.email, allowlist)) return NextResponse.next();
    return NextResponse.json({ error: 'beta_privado', message: 'Acesso em fase de testes.' }, { status: 403 });
  }

  if (isPublicPagePath(pathname)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.next();
  if (isEmailAllowedInPrivateBeta(token.email, allowlist)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/em-breve';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

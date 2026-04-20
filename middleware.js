import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  hasFinmemoryAdminAllowlist,
  isFinmemoryAdminEmail,
} from './lib/adminAccess';
import { getPrivateBetaAllowlistFromEnv, isEmailAllowedInPrivateBeta } from './lib/privateBetaAllowlist';

/** APIs que devem funcionar sem passar pelo filtro de beta (webhooks, auth, health). */
function isPublicApiPath(pathname) {
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname === '/api/health') return true;
  if (pathname.startsWith('/api/pluggy/webhook')) return true;
  if (pathname === '/api/webhook') return true;
  if (pathname === '/api/signup') return true;
  return false;
}

/** Páginas que qualquer pessoa pode ver mesmo com sessão “não autorizada” no beta. */
function isPublicPagePath(pathname) {
  if (pathname === '/') return true;
  if (pathname.startsWith('/login')) return true;
  if (pathname.startsWith('/em-breve')) return true;
  if (pathname.startsWith('/privacidade')) return true;
  if (pathname.startsWith('/termos')) return true;
  return false;
}

export async function middleware(req) {
  const allowlist = getPrivateBetaAllowlistFromEnv();
  if (!allowlist) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/_next')) return NextResponse.next();

  if (pathname.startsWith('/api')) {
    if (isPublicApiPath(pathname)) return NextResponse.next();
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (
      hasFinmemoryAdminAllowlist() &&
      pathname.startsWith('/api/admin') &&
      token?.email &&
      isFinmemoryAdminEmail(token.email)
    ) {
      return NextResponse.next();
    }
    if (!token) return NextResponse.next();
    const email = token.email;
    if (isEmailAllowedInPrivateBeta(email, allowlist)) return NextResponse.next();
    return NextResponse.json({ error: 'beta_privado', message: 'Acesso em fase de testes.' }, { status: 403 });
  }

  if (isPublicPagePath(pathname)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (
    hasFinmemoryAdminAllowlist() &&
    pathname.startsWith('/admin') &&
    token?.email &&
    isFinmemoryAdminEmail(token.email)
  ) {
    return NextResponse.next();
  }
  if (!token) return NextResponse.next();

  if (isEmailAllowedInPrivateBeta(token.email, allowlist)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/em-breve';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|manifest-admin\\.webmanifest).*)',
  ],
};

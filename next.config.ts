import type { NextConfig } from 'next';
import path from 'path';

/** Upstream PostHog (ingest + assets) conforme `NEXT_PUBLIC_POSTHOG_HOST` no build. */
function posthogUpstream() {
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || '').toLowerCase();
  if (host.includes('eu.i.posthog.com') || host.includes('eu.posthog.com')) {
    return {
      ingest: 'https://eu.i.posthog.com/:path*',
      assets: 'https://eu-assets.i.posthog.com/static/:path*',
    };
  }
  return {
    ingest: 'https://us.i.posthog.com/:path*',
    assets: 'https://us-assets.i.posthog.com/static/:path*',
  };
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Necessário para Docker/Cloud Run
  trailingSlash: false,
  // Cloud Build / ESLint 9+: evita falha do build por opções legadas do next lint
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Evitar que Next.js infira workspace root (ex.: pasta Downloads) e coloque standalone em subpasta
  outputFileTracingRoot: path.join(__dirname),
  // iOS/Safari + reverse proxy PostHog (mesmo origin → menos bloqueios)
  async rewrites() {
    const ph = posthogUpstream();
    return [
      { source: '/apple-touch-icon.png', destination: '/logo.png' },
      { source: '/apple-touch-icon-precomposed.png', destination: '/logo.png' },
      { source: '/ingest/static/:path*', destination: ph.assets },
      { source: '/ingest/:path*', destination: ph.ingest },
    ];
  },
  /** Reduz HTML/JSON cacheado com buildId antigo após deploy (Cloud Run). */
  async headers() {
    const noStore = [
      { key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' },
    ];
    const appPages = [
      '/',
      '/login',
      '/mapa',
      '/dashboard',
      '/cartoes',
      '/add-receipt',
      '/settings',
      '/notifications',
      '/scan-product',
      '/share-price',
      '/shopping-list',
      '/partnership',
      '/manual-entry',
      '/categories',
      '/reports',
      '/calculadora',
      '/listas',
      '/simulador',
    ];
    return [
      ...appPages.map((source) => ({ source, headers: noStore })),
      { source: '/_next/data/:path*', headers: noStore },
      { source: '/transaction/:path*', headers: noStore },
    ];
  },
};

export default nextConfig;

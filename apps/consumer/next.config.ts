import type { NextConfig } from 'next';
import path from 'path';
import { config as loadEnv } from 'dotenv';

/** Carrega .env da raiz do monorepo (dev local + Cloud Build). */
const monorepoRoot = path.join(__dirname, '../..');
loadEnv({ path: path.join(monorepoRoot, '.env') });
loadEnv({ path: path.join(monorepoRoot, '.env.local'), override: true });
loadEnv({ path: path.join(monorepoRoot, '.env.production') });

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

function retailerAppBaseUrl(): string {
  const runApp =
    process.env.FINMEMORY_RETAILER_CLOUD_RUN_URL ||
    'https://finmemory-retailer-836908221936.southamerica-east1.run.app';
  const fromEnv =
    process.env.NEXT_PUBLIC_RETAILER_APP_URL || process.env.NEXT_PUBLIC_FINMEMORY_RETAILER_URL || '';
  const base =
    fromEnv && !/parceiros\.finmemory\.com\.br/i.test(fromEnv) ? fromEnv : runApp;
  return base.replace(/\/$/, '');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Necessário para Docker/Cloud Run
  transpilePackages: ['@finmemory/shared', '@finmemory/ui'],
  trailingSlash: false,
  // Cloud Build / ESLint 9+: evita falha do build por opções legadas do next lint
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Evitar que Next.js infira workspace root (ex.: pasta Downloads) e coloque standalone em subpasta
  outputFileTracingRoot: monorepoRoot,
  /** Lojista vive no app retailer (subdomínio); evita 404 em finmemory.com.br/parceiros */
  async redirects() {
    const retailer = retailerAppBaseUrl();
    return [
      { source: '/parceiros', destination: `${retailer}/parceiros`, permanent: false },
      { source: '/parceiros/:path*', destination: `${retailer}/parceiros/:path*`, permanent: false },
      { source: '/escolher-perfil', destination: `${retailer}/escolher-perfil`, permanent: false },
      {
        source: '/historico-inventario-varejo',
        destination: `${retailer}/historico-inventario-varejo`,
        permanent: false,
      },
      { source: '/mapa-precos', destination: '/mapa', permanent: true },
      { source: '/mapa-precos/:path*', destination: '/mapa', permanent: true },
    ];
  },
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

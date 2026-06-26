import type { NextConfig } from 'next';
import path from 'path';
import { config as loadEnv } from 'dotenv';

const monorepoRoot = path.join(__dirname, '../..');
loadEnv({ path: path.join(monorepoRoot, '.env') });
loadEnv({ path: path.join(monorepoRoot, '.env.local'), override: true });
loadEnv({ path: path.join(monorepoRoot, '.env.production') });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@finmemory/shared', '@finmemory/ui'],
  trailingSlash: false,
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: monorepoRoot,
  async headers() {
    const noStore = [
      { key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' },
    ];
    const hsts =
      process.env.NODE_ENV === 'production'
        ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains; preload',
            },
          ]
        : [];
    const securePages = [...noStore, ...hsts];
    return [
      { source: '/:path*', headers: hsts },
      { source: '/parceiros', headers: securePages },
      { source: '/parceiros/painel', headers: securePages },
      { source: '/mapa', headers: securePages },
      { source: '/login', headers: securePages },
      { source: '/escolher-perfil', headers: securePages },
    ];
  },
};

export default nextConfig;

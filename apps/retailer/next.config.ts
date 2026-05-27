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
    return [
      { source: '/parceiros', headers: noStore },
      { source: '/parceiros/painel', headers: noStore },
      { source: '/login', headers: noStore },
      { source: '/escolher-perfil', headers: noStore },
    ];
  },
};

export default nextConfig;

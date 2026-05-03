const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Necessário para Docker/Cloud Run
  trailingSlash: false,
  // Cloud Build / ESLint 9+: evita falha do build por opções legadas do next lint
  eslint: {
    ignoreDuringBuilds: true
  },
  // Evitar que Next.js infira workspace root (ex.: pasta Downloads) e coloque standalone em subpasta
  outputFileTracingRoot: path.join(__dirname),
  // iOS/Safari pedem esses paths; redirecionar para o logo para evitar 404
  async rewrites() {
    return [
      { source: '/apple-touch-icon.png', destination: '/logo.png' },
      { source: '/apple-touch-icon-precomposed.png', destination: '/logo.png' },
    ]
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
}

module.exports = nextConfig
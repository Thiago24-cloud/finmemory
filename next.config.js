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
}

module.exports = nextConfig
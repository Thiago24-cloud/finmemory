/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Necessário para Docker/Cloud Run
  // Garantir que todas as rotas sejam servidas corretamente
  trailingSlash: false,
}

module.exports = nextConfig
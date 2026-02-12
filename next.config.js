const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Necessário para Docker/Cloud Run
  trailingSlash: false,
  // Evitar que Next.js infira workspace root (ex.: pasta Downloads) e coloque standalone em subpasta
  outputFileTracingRoot: path.join(__dirname),
}

module.exports = nextConfig
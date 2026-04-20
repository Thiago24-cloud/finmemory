import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** Pastas espelhadas / legado fora do bundle principal do Next — evita ruído no `npm run lint`. */
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'android/**',
      'ios/**',
      'finmemory-agent/**',
      'supabase/.temp/**',
      'print mambo .png',
      '_smart-receipt-scanner/**',
      'src/**',
      'cloudflare-worker-auth-bypass.js',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
];

export default eslintConfig;

#!/usr/bin/env node
/**
 * Deploy temporário (consumer + retailer) na Vercel enquanto GCP billing estiver off.
 *
 * Pré-requisitos:
 *   npx vercel login
 *   ou VERCEL_TOKEN no ambiente
 *
 * Uso:
 *   node scripts/deploy-vercel-temporary.mjs
 *   node scripts/deploy-vercel-temporary.mjs --consumer-only
 */
import { execSync, spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';

const root = resolve(process.cwd());
loadEnv({ path: resolve(root, '.env') });
loadEnv({ path: resolve(root, '.env.local'), override: true });

const consumerOnly = process.argv.includes('--consumer-only');

function sh(cmd, cwd = root) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

function parseEnvLocal() {
  const path = resolve(root, '.env.local');
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Variáveis mínimas para o app subir na Vercel. */
const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_FINMEMORY_PUBLIC_ACCESS',
  'FINMEMORY_PUBLIC_ACCESS',
  'FINMEMORY_ADMIN_EMAILS',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_CONSUMER_APP_URL',
  'NEXT_PUBLIC_RETAILER_APP_URL',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'DIA_IMPORT_SECRET',
  'ATACADAO_IMPORT_SECRET',
];

function syncEnvToVercel(appDir, nextAuthUrl) {
  const env = parseEnvLocal();
  for (const key of ENV_KEYS) {
    const val = env[key];
    if (!val) continue;
    const value = key === 'NEXTAUTH_URL' && nextAuthUrl ? nextAuthUrl : val;
    try {
      spawnSync(
        'npx',
        ['vercel', 'env', 'add', key, 'production', '--force'],
        {
          cwd: appDir,
          input: value,
          stdio: ['pipe', 'inherit', 'inherit'],
          shell: true,
          env: process.env,
        }
      );
    } catch {
      /* env add pode falhar se CLI pedir confirmação — configure no dashboard se necessário */
    }
  }
}

function deployApp(name, rootDir) {
  console.log(`\n========== ${name} (root: ${rootDir}) ==========\n`);
  sh(`npx vercel link --project ${name} --yes`, root);
  sh(`npx vercel deploy --prod --yes`, root);
}

try {
  execSync('npx vercel whoami', { stdio: 'pipe', env: process.env });
} catch {
  console.error(`
❌ Vercel não autenticado.

1. Rode:  npx vercel login
2. Abra o link no browser e confirme
3. Rode de novo:  node scripts/deploy-vercel-temporary.mjs
`);
  process.exit(1);
}

console.log('[deploy-vercel-temporary] Deploy temporário — volte ao Cloud Run após regularizar GCP billing.\n');

const consumerDir = resolve(root, 'apps/consumer');
const retailerDir = resolve(root, 'apps/retailer');

// Env vars: configure no dashboard se o sync falhar (https://vercel.com/dashboard)
console.log('Dica: se o build falhar por env, adicione variáveis em Settings → Environment Variables.\n');

deployApp('finmemory', 'apps/consumer');

if (!consumerOnly) {
  deployApp('finmemory-retailer', 'apps/retailer');
}

console.log('\n✅ Deploy Vercel concluído. URLs em https://vercel.com/dashboard\n');
console.log('Na sexta (GCP ok): npm run deploy:cloud-run && npm run deploy:cloud-run:retailer\n');

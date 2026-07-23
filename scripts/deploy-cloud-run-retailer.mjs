#!/usr/bin/env node
/**
 * Deploy FinMemory Retailer → Google Cloud Run via Cloud Build (cloudbuild.retailer.yaml).
 * Uso:
 *   npm run deploy:cloud-run:retailer
 */
import { execSync, spawnSync } from 'child_process';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true });

const GCP_PROJECT =
  process.env.GCLOUD_PROJECT?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  'exalted-entry-480904-s9';

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
const stripePublishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || '';
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || '';
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || '';
const mapboxToken =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ||
  process.env._MAPBOX_ACCESS_TOKEN?.trim() ||
  '';
const publicAccess =
  process.env.NEXT_PUBLIC_FINMEMORY_PUBLIC_ACCESS?.trim() ||
  process.env.FINMEMORY_PUBLIC_ACCESS?.trim() ||
  '1';
function productionBaseUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (url.startsWith('http://') && !/localhost|127\.0\.0\.1/i.test(url)) {
    return `https://${url.slice('http://'.length)}`;
  }
  return url;
}

const RETAILER_CLOUD_RUN_URL =
  process.env.FINMEMORY_RETAILER_CLOUD_RUN_URL?.trim() ||
  'https://finmemorycomerciantes-836908221936.southamerica-east1.run.app';
const retailerFromEnv =
  process.env.NEXT_PUBLIC_RETAILER_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXTAUTH_URL?.trim() ||
  '';
const retailerBase = productionBaseUrl(
  retailerFromEnv && !/parceiros\.finmemory\.com\.br/i.test(retailerFromEnv)
    ? retailerFromEnv
    : RETAILER_CLOUD_RUN_URL
);
const consumerBase = productionBaseUrl(
  process.env.NEXT_PUBLIC_CONSUMER_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_FINMEMORY_CONSUMER_URL?.trim() ||
    'https://finmemory.com.br'
);

if (!supabaseUrl || !supabaseAnon) {
  console.error(
    '[deploy-cloud-run:retailer] Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env/.env.local.'
  );
  process.exit(1);
}

if (!mapboxToken) {
  console.warn(
    '[deploy-cloud-run:retailer] Aviso: NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN vazio — o mapa de preços pode ficar sem tiles Mapbox.'
  );
}

if (!retailerBase) {
  console.warn(
    '[deploy-cloud-run:retailer] Aviso: NEXT_PUBLIC_RETAILER_APP_URL vazio; usando fallback do app.'
  );
}

let commitSha;
try {
  commitSha = sh('git rev-parse HEAD', { silent: true }).trim();
} catch {
  console.error('[deploy-cloud-run:retailer] Falha ao obter commit (git rev-parse HEAD).');
  process.exit(1);
}

const substitutions = [
  `_COMMIT_SHA=${commitSha}`,
  `_NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`,
  `_NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnon}`,
  `_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${stripePublishable}`,
  `_NEXT_PUBLIC_POSTHOG_KEY=${posthogKey}`,
  `_NEXT_PUBLIC_POSTHOG_HOST=${posthogHost}`,
  `_NEXT_PUBLIC_FINMEMORY_PUBLIC_ACCESS=${publicAccess}`,
  `_NEXT_PUBLIC_RETAILER_APP_URL=${retailerBase}`,
  `_NEXT_PUBLIC_CONSUMER_APP_URL=${consumerBase}`,
  `_NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=${mapboxToken}`,
].join(',');

console.log(`[deploy-cloud-run:retailer] Projeto GCP: ${GCP_PROJECT}`);

const result = spawnSync(
  'gcloud',
  [
    'builds',
    'submit',
    `--project=${GCP_PROJECT}`,
    '--config=cloudbuild.retailer.yaml',
    `--substitutions=${substitutions}`,
  ],
  { stdio: 'inherit', shell: true }
);

if (result.error) {
  console.error('[deploy-cloud-run:retailer]', result.error.message);
  process.exit(1);
}

if (result.status === 0) {
  console.log('\n[deploy-cloud-run:retailer] Deploy concluído.');
  console.log('  • Serviço: finmemorycomerciantes (Cloud Run, southamerica-east1)');
  console.log(
    '  • URL: https://finmemorycomerciantes-836908221936.southamerica-east1.run.app'
  );
  console.log(
    '  • Health: https://finmemorycomerciantes-836908221936.southamerica-east1.run.app/api/health\n'
  );
}

process.exit(result.status === 0 ? 0 : result.status ?? 1);

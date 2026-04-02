#!/usr/bin/env node
/**
 * 1) Cloud Build: build + push finmemory-promo-agent-all (Dockerfile.all).
 * 2) Cloud Run Job: finmemory-promo-agent-all — executa `node agent.js` (todas as redes em SCRAPERS).
 *
 * Pré-requisitos: gcloud autenticado, projeto GCP correto, .env / .env.local com:
 *   NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso: npm run deploy:promo-agent-all
 *
 * Opcional: PROMO_JOB_TASK_TIMEOUT_S (default 14400 = 4h), PROMO_JOB_MEMORY (default 4Gi), PROMO_JOB_CPU (default 2)
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

const REGION = process.env.PROMO_JOB_REGION?.trim() || 'southamerica-east1';
const JOB_NAME = process.env.PROMO_JOB_NAME?.trim() || 'finmemory-promo-agent-all';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
}

if (!supabaseUrl || !serviceKey) {
  console.error(
    '[deploy-promo-agent-all] Defina NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no .env.local'
  );
  process.exit(1);
}

let tag;
try {
  tag = sh('git rev-parse --short HEAD', { silent: true }).trim();
} catch {
  tag = `manual-${Date.now()}`;
}

const timeoutSec = Math.max(
  3600,
  Math.min(86400, Number.parseInt(process.env.PROMO_JOB_TASK_TIMEOUT_S || '14400', 10) || 14400)
);
const memory = process.env.PROMO_JOB_MEMORY?.trim() || '4Gi';
const cpu = process.env.PROMO_JOB_CPU?.trim() || '2';

const substitutions = `_TAG=${tag}`;

console.log(`[deploy-promo-agent-all] Projeto: ${GCP_PROJECT}`);
console.log(`[deploy-promo-agent-all] Imagem: gcr.io/${GCP_PROJECT}/finmemory-promo-agent-all:${tag}`);

const build = spawnSync(
  'gcloud',
  [
    'builds',
    'submit',
    `--project=${GCP_PROJECT}`,
    '--config=cloudbuild-promo-agent-all.yaml',
    `--substitutions=${substitutions}`,
    '.',
  ],
  { stdio: 'inherit', shell: true }
);

if (build.error) {
  console.error('[deploy-promo-agent-all]', build.error.message);
  process.exit(1);
}
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const image = `gcr.io/${GCP_PROJECT}/finmemory-promo-agent-all:${tag}`;

// Variáveis mínimas para finmemory-agent/agent.js
const envVars = [
  `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`,
  `SUPABASE_URL=${supabaseUrl}`,
  `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,
  `TTL_HOURS=${process.env.TTL_HOURS || '72'}`,
  `CONCURRENCY=${process.env.CONCURRENCY || '1'}`,
  `DIA_MAX_STORE_PAGES=${process.env.DIA_MAX_STORE_PAGES || '250'}`,
  `DIA_REGION_PAGE_PATHS=${process.env.DIA_REGION_PAGE_PATHS || 'lojas-sp-capital'}`,
].join(',');

const deploy = spawnSync(
  'gcloud',
  [
    'run',
    'jobs',
    'deploy',
    JOB_NAME,
    `--project=${GCP_PROJECT}`,
    `--region=${REGION}`,
    `--image=${image}`,
    '--tasks=1',
    '--max-retries=0',
    `--task-timeout=${timeoutSec}s`,
    `--memory=${memory}`,
    `--cpu=${cpu}`,
    `--set-env-vars=${envVars}`,
  ],
  { stdio: 'inherit', shell: true }
);

if (deploy.status !== 0) {
  process.exit(deploy.status ?? 1);
}

console.log('\n[deploy-promo-agent-all] Job criado/atualizado.');
console.log(`  Executar agora: gcloud run jobs execute ${JOB_NAME} --region=${REGION} --project=${GCP_PROJECT} --wait`);
console.log(
  '  Agendar 2×/dia: npm run promo:scheduler:setup   (ou scripts/setup-promo-scheduler.ps1 / .sh)\n'
);

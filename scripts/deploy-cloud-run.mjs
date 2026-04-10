#!/usr/bin/env node
/**
 * Deploy FinMemory → Google Cloud Run via Cloud Build (cloudbuild.yaml).
 * Uso: no `.env` / `.env.local`: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (ou _MAPBOX_ACCESS_TOKEN). Depois:
 *   npm run deploy:cloud-run
 *
 * Carrega `.env` e `.env.local` na raiz (vars usadas no build Docker).
 * O Cloud Build corre sempre no projeto GCP abaixo (não depende só do `gcloud config set`).
 *
 * Projeto de produção: **exalted-entry-480904-s9** (FinMemory). Não usar finmemory-667c3.
 * Override: variável de ambiente `GCLOUD_PROJECT` ou `GOOGLE_CLOUD_PROJECT`.
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
const mapbox =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ||
  process.env._MAPBOX_ACCESS_TOKEN?.trim() ||
  '';

if (!supabaseUrl || !supabaseAnon) {
  console.error(
    '[deploy-cloud-run] Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env ou .env.local (mesmos valores do dev local).'
  );
  process.exit(1);
}

if (!mapbox) {
  console.warn(
    '[deploy-cloud-run] Aviso: NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN vazio — o build do Docker pode falhar ou o mapa ficar sem token.'
  );
}

let commitSha;
try {
  commitSha = sh('git rev-parse HEAD', { silent: true }).trim();
} catch {
  console.error('[deploy-cloud-run] Falha ao obter commit (git rev-parse HEAD).');
  process.exit(1);
}

const substitutions = [
  `_COMMIT_SHA=${commitSha}`,
  `_NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`,
  `_NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnon}`,
  `_MAPBOX_ACCESS_TOKEN=${mapbox}`,
].join(',');

console.log(`[deploy-cloud-run] Projeto GCP: ${GCP_PROJECT}`);

const result = spawnSync(
  'gcloud',
  [
    'builds',
    'submit',
    `--project=${GCP_PROJECT}`,
    '--config=cloudbuild.yaml',
    `--substitutions=${substitutions}`,
  ],
  { stdio: 'inherit', shell: true }
);

if (result.error) {
  console.error('[deploy-cloud-run]', result.error.message);
  process.exit(1);
}

if (result.status === 0) {
  const runUrl = 'https://finmemory-836908221936.southamerica-east1.run.app';
  console.log('\n[deploy-cloud-run] Deploy concluído.');
  console.log(`  • Health: ${runUrl}/api/health`);
  console.log('  • Em checks.authEnv: nextauthSecret, googleOAuth e supabaseServiceRole devem refletir o que está no Cloud Run.');
  console.log('  • Se login falhar: NEXTAUTH_URL = URL exata no browser; Google Console → redirect = NEXTAUTH_URL/api/auth/callback/google');
  console.log('  • Script env: .\\scripts\\set-cloud-run-env.ps1 (ver DEPLOY-CLOUD-RUN.md)\n');
}

process.exit(result.status === 0 ? 0 : result.status ?? 1);

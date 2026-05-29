import { isR2Configured } from './uploadToR2';

const R2_ENV_KEYS = [
  'CLOUDFLARE_R2_ENDPOINT',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
];

function bucketEnvPresent() {
  return Boolean(process.env.CLOUDFLARE_R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET_NAME);
}

function publicBaseEnvPresent() {
  return Boolean(process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL);
}

export function isCloudProduction() {
  if (process.env.FINMEMORY_REQUIRE_R2 === '1') return true;
  if (process.env.K_SERVICE) return true;
  if (process.env.VERCEL === '1') return true;
  return false;
}

export function getR2ProductionConfigError() {
  const missing = R2_ENV_KEYS.filter((k) => !process.env[k]);
  if (!bucketEnvPresent()) missing.push('CLOUDFLARE_R2_BUCKET');
  if (!publicBaseEnvPresent()) missing.push('CLOUDFLARE_R2_PUBLIC_BASE_URL');
  return missing;
}

/** @param {import('next').NextApiResponse} res */
export function ensureR2ForProductionApi(res) {
  if (!isCloudProduction()) return true;
  if (isR2Configured()) return true;
  res.status(503).json({
    success: false,
    error: 'Armazenamento R2 não configurado neste ambiente.',
    code: 'R2_PRODUCTION_REQUIRED',
  });
  return false;
}

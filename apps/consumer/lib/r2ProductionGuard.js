import { isR2Configured } from './uploadToR2';

const R2_ENV_KEYS = [
  'CLOUDFLARE_R2_ENDPOINT',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
];

function bucketEnvPresent() {
  return Boolean(
    process.env.CLOUDFLARE_R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET_NAME
  );
}

function publicBaseEnvPresent() {
  return Boolean(
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL
  );
}

/** Ambiente de nuvem onde R2 deve estar sempre configurado. */
export function isCloudProduction() {
  if (process.env.FINMEMORY_REQUIRE_R2 === '1') return true;
  if (process.env.K_SERVICE) return true;
  if (process.env.VERCEL === '1') return true;
  return false;
}

/** @returns {string[]} nomes de variáveis em falta */
export function getR2ProductionConfigError() {
  const missing = R2_ENV_KEYS.filter((k) => !process.env[k]);
  if (!bucketEnvPresent()) {
    missing.push('CLOUDFLARE_R2_BUCKET (ou CLOUDFLARE_R2_BUCKET_NAME)');
  }
  if (!publicBaseEnvPresent()) {
    missing.push('CLOUDFLARE_R2_PUBLIC_BASE_URL (ou CLOUDFLARE_R2_PUBLIC_URL)');
  }
  return missing;
}

/** Falha o boot do servidor Node em produção na nuvem sem R2. */
export function assertR2ProductionConfigured() {
  if (!isCloudProduction()) return;
  if (isR2Configured()) return;

  const missing = getR2ProductionConfigError();
  const msg =
    `[FinMemory] Cloudflare R2 é obrigatório neste ambiente (produção). ` +
    `Configure: ${missing.join(', ')}`;

  const err = new Error(msg);
  err.code = 'R2_PRODUCTION_REQUIRED';
  throw err;
}

/**
 * Trava por pedido nas APIs de comprovante (caso o boot tenha passado sem R2).
 * @param {import('next').NextApiResponse} res
 * @returns {boolean} false se bloqueou a resposta
 */
export function ensureR2ForProductionApi(res) {
  if (!isCloudProduction()) return true;
  if (isR2Configured()) return true;

  res.status(503).json({
    success: false,
    error: 'Armazenamento de comprovantes (Cloudflare R2) não configurado neste ambiente.',
    code: 'R2_PRODUCTION_REQUIRED',
    missing: getR2ProductionConfigError(),
  });
  return false;
}

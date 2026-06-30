import type { CieloConfig, CieloEnvironment } from './types';

const CIELO_URLS: Record<
  CieloEnvironment,
  { transaction: string; query: string }
> = {
  sandbox: {
    transaction: 'https://apisandbox.cieloecommerce.cielo.com.br',
    query: 'https://apiquerysandbox.cieloecommerce.cielo.com.br',
  },
  production: {
    transaction: 'https://api.cieloecommerce.cielo.com.br',
    query: 'https://apiquery.cieloecommerce.cielo.com.br',
  },
};

function normalizeEnvironment(raw: string | undefined): CieloEnvironment {
  const v = String(raw || 'sandbox').trim().toLowerCase();
  if (v === 'production' || v === 'prod' || v === 'live') return 'production';
  return 'sandbox';
}

/**
 * Lê credenciais Cielo do ambiente do servidor.
 * Opcional: CIELO_TRANSACTION_URL / CIELO_QUERY_URL para override pontual.
 */
export function getCieloConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CieloConfig | null {
  const merchantId = env.CIELO_MERCHANT_ID?.trim();
  const merchantKey = env.CIELO_MERCHANT_KEY?.trim();
  if (!merchantId || !merchantKey) return null;

  const environment = normalizeEnvironment(env.CIELO_ENV);
  const defaults = CIELO_URLS[environment];

  return {
    merchantId,
    merchantKey,
    environment,
    transactionBaseUrl: (
      env.CIELO_TRANSACTION_URL?.trim() || defaults.transaction
    ).replace(/\/$/, ''),
    queryBaseUrl: (env.CIELO_QUERY_URL?.trim() || defaults.query).replace(
      /\/$/,
      '',
    ),
  };
}

export function isCieloConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return getCieloConfigFromEnv(env) !== null;
}

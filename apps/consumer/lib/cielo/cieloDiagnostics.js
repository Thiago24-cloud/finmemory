import { isCieloConfigured } from '@finmemory/shared/payments/cielo';

/**
 * Diagnóstico rápido para /api/health e logs de deploy.
 */
export function getCieloPaymentDiagnostics() {
  const configured = isCieloConfigured();
  const environment = (process.env.CIELO_ENV || 'sandbox').trim().toLowerCase();
  const issues = [];

  if (!configured) {
    issues.push('CIELO_MERCHANT_ID e CIELO_MERCHANT_KEY não configurados.');
  }

  return {
    ok: configured,
    checks: {
      merchantCredentials: configured,
      environment: environment === 'production' ? 'production' : 'sandbox',
    },
    issues,
  };
}

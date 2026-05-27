import { stripeAppBaseUrl } from './appBaseUrl';
import { stripePriceIdsFromEnv } from '../stripePlanPrice';

/**
 * Diagnóstico Stripe Checkout (sem expor segredos).
 * @returns {{ ok: boolean, issues: string[], checks: Record<string, boolean> }}
 */
export function getStripeCheckoutDiagnostics() {
  const issues = [];
  const secret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const publishable = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());
  const webhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const baseUrl = stripeAppBaseUrl();
  const prices = stripePriceIdsFromEnv();

  if (!secret) issues.push('STRIPE_SECRET_KEY ausente no servidor.');
  if (!publishable) {
    issues.push(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ausente no build (redeploy com a chave no Cloud Build).'
    );
  }
  if (!webhook) issues.push('STRIPE_WEBHOOK_SECRET ausente (assinaturas não atualizam após pagamento).');
  if (!baseUrl) issues.push('Defina NEXT_PUBLIC_APP_URL ou NEXTAUTH_URL (URL https válida).');

  for (const plan of ['pro', 'familia', 'enterprise']) {
    if (!prices[plan]) {
      issues.push(`Price ID do plano "${plan}" não configurado (STRIPE_*_PRICE_ID).`);
    }
  }

  const nextAuth = String(process.env.NEXTAUTH_URL || '').trim();
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (
    appUrl.includes('finmemory.com.br') &&
    nextAuth.includes('run.app') &&
    !nextAuth.includes('finmemory.com.br')
  ) {
    issues.push(
      'NEXTAUTH_URL aponta para *.run.app mas NEXT_PUBLIC_APP_URL é finmemory.com.br — alinhe NEXTAUTH_URL ao domínio público.'
    );
  }

  return {
    ok: issues.length === 0,
    issues,
    checks: {
      secret,
      publishable,
      webhook,
      baseUrl: Boolean(baseUrl),
      pricePro: Boolean(prices.pro),
      priceFamilia: Boolean(prices.familia),
      priceEnterprise: Boolean(prices.enterprise),
    },
  };
}

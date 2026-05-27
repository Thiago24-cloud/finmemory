/**
 * FinMemory — Estrutura de Planos
 * Fonte da verdade. Importar em: paywall, checkout, webhook, CRM, admin.
 *
 * Atualizado: Mai/2026
 * Slug canonical em DB/checkout/metadata: familia | pro | enterprise (família sempre normaliza→familia)
 */

export const PLANS = {
  free: {
    id: 'free',
    label: 'Free',
    price: 0,
    priceFormatted: 'Gratuito',
    canal: 'direto',
    members: 1,
    openFinancePerMember: 0,
    totalConnections: 0,
    stripePriceId: null,
    features: [
      'Scan de NF-e (QR Code)',
      'Mapa de preços (básico)',
      'Controle de gastos manual',
      'Open Finance — 1 banco (sem prazo)',
    ],
    highlight: false,
    badge: null,
  },

  pro: {
    id: 'pro',
    label: 'Pro',
    price: 24.9,
    priceFormatted: 'R$24,90/mês',
    canal: 'direto',
    members: 1,
    openFinancePerMember: 3,
    totalConnections: 3,
    stripePriceId: 'price_1TSMW3IploEtOf6az2g4IMMa',
    features: [
      'Tudo do Free',
      'Open Finance — até 3 bancos conectados',
      'Histórico exportável',
      'Alertas de preço no mapa',
      'Relatórios automáticos',
    ],
    highlight: true,
    badge: 'Mais popular',
  },

  família: {
    id: 'família',
    label: 'Família',
    price: 99.9,
    priceFormatted: 'R$99,90/mês',
    pricePerMember: 19.98,
    canal: 'direto',
    members: 5,
    openFinancePerMember: 3,
    totalConnections: 15,
    stripePriceId: 'price_1TSMM7IploEtOf6aL2SEUw2T',
    features: [
      'Tudo do Pro',
      'Até 5 membros na mesma conta',
      'Open Finance — 3 bancos por membro (15 conexões)',
      'Painel familiar consolidado',
      'Cada membro por ~R$20/mês (vs R$24,90 no Pro)',
    ],
    highlight: false,
    badge: 'Melhor custo-benefício',
  },

  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    /** Não aparece em /planos nem em atalhos de upgrade; checkout via link direto (/checkout?plan=enterprise). */
    hiddenFromPublicListing: true,
    price: 17.9,
    priceFormatted: 'R$17,90/mês',
    canal: 'contador',
    members: 1,
    openFinancePerMember: 3,
    totalConnections: 3,
    commission: 0.25,
    commissionValue: 4.48,
    stripePriceId: 'price_1TSMPPIploEtOf6ahk5P6piW',
    features: [
      'Tudo do Pro',
      'Open Finance — até 3 bancos conectados',
      'Onboarding guiado pelo escritório parceiro',
      'Acesso exclusivo via link do contador',
    ],
    highlight: false,
    badge: 'Via parceiro',
  },
};

/** Planos que podem concluir pagamento (Stripe + webhook + Supabase). */
const CHECKOUT_CANONICAL = ['pro', 'familia', 'enterprise'];

/** Planos exibidos em /planos, Ajustes e upsell — Enterprise é só por link externo. */
export const PUBLIC_LISTED_CHECKOUT_PLANS = ['pro', 'familia'];

/** Stripe metadata / API body: sempre sem acento por consistência no Supabase. */
const PLAN_ALIASES = { família: 'familia' };

function normalizePlan(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return PLAN_ALIASES[normalized] || normalized;
}

export function isCheckoutPlan(value) {
  return CHECKOUT_CANONICAL.includes(normalizePlan(value));
}

/** UI pública (menu de assinaturas). Enterprise continua em isCheckoutPlan para links diretos. */
export function isPlanListedPublicly(value) {
  return PUBLIC_LISTED_CHECKOUT_PLANS.includes(normalizePlan(value));
}

export function checkoutPlanOrDefault(value) {
  const p = normalizePlan(value);
  return isCheckoutPlan(p) ? p : 'pro';
}

/** Preferência: env do servidor/cliente público sobrescreve IDs embutidos no PLANS (útil por ambiente). */
export function stripePriceIdsFromEnv() {
  const plus =
    process.env.STRIPE_PLUS_PRICE_ID?.trim() ||
    process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID?.trim() ||
    '';
  const fromEnv = {
    pro:
      process.env.STRIPE_PRO_PRICE_ID?.trim() ||
      process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID?.trim() ||
      plus ||
      '',
    familia:
      process.env.STRIPE_FAMILIA_PRICE_ID?.trim() ||
      process.env.NEXT_PUBLIC_STRIPE_FAMILIA_PRICE_ID?.trim() ||
      '',
    enterprise:
      process.env.STRIPE_ENTERPRISE_PRICE_ID?.trim() ||
      process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID?.trim() ||
      '',
  };

  const allowEmbedded =
    process.env.STRIPE_ALLOW_EMBEDDED_PRICE_IDS === '1' ||
    process.env.NODE_ENV !== 'production';

  return {
    pro: fromEnv.pro || (allowEmbedded ? PLANS.pro.stripePriceId : '') || '',
    familia: fromEnv.familia || (allowEmbedded ? PLANS['família'].stripePriceId : '') || '',
    enterprise:
      fromEnv.enterprise || (allowEmbedded ? PLANS.enterprise.stripePriceId : '') || '',
  };
}

/** Webhook: recebe priceId do Stripe → qual plano ativar no Supabase (slug ascii). */
export function getPlanByPriceId(priceId) {
  const id = String(priceId || '').trim();
  const match = Object.values(PLANS).find((p) => p.stripePriceId && p.stripePriceId === id);
  if (!match?.id) return 'free';
  return match.id === 'família' ? 'familia' : match.id;
}

/** @param {string | null | undefined} priceId */
export function planFromStripePriceId(priceId) {
  const id = String(priceId || '').trim();
  if (!id) return 'free';
  const m = stripePriceIdsFromEnv();
  if (id === m.pro) return 'pro';
  if (id === m.familia) return 'familia';
  if (id === m.enterprise) return 'enterprise';
  const slug = getPlanByPriceId(id);
  return slug !== 'free' ? slug : null;
}

const month = new Date().getMonth();
export const PLUGGY_MONTHLY_COST = month >= 8 ? 5000 : 2500;

export const BREAKEVEN = Object.fromEntries(
  Object.entries(PLANS)
    .filter(([, p]) => p.price > 0)
    .map(([key, p]) => [key, Math.ceil(PLUGGY_MONTHLY_COST / p.price)])
);

export function getPlan(key) {
  const slug = normalizePlan(key);
  const objKey = slug === 'familia' ? 'família' : slug;
  const row = PLANS[objKey];
  return row || PLANS.free;
}

export function getPriceId(key) {
  const slug = normalizePlan(key);
  const pid = stripePriceIdsFromEnv()[slug];
  return pid ? pid.trim() : null;
}

export function getMRR(users) {
  return users
    .filter((u) => u.plano_ativo && normalizePlan(u.plano) !== 'free')
    .reduce((sum, u) => sum + (getPlan(u.plano).price || 0), 0);
}

export const PLANS_LIST = ['free', 'pro', 'família', 'enterprise'];

/** Slugs pagos visíveis na interface (sem Enterprise). */
export const PLANS_LIST_PUBLIC = ['free', 'pro', 'família'];

/**
 * Catálogo de planos alinhado à landing institucional (finmemory.com.br).
 * Fonte de verdade para hub /inicio e trial sem pagamento.
 */

export const CONSUMER_TRIAL_DAYS = 30;

/** @typedef {'free'|'plus'|'pro'|'familia'} ConsumerPlanId */

/** @type {Record<ConsumerPlanId, object>} */
export const CONSUMER_PLANS = {
  free: {
    id: 'free',
    audience: 'consumer',
    label: 'Gratuito',
    priceLabel: 'R$ 0',
    priceNote: 'sempre',
    landingBlurb: 'Caça-preço no mapa, lista e 1 banco Open Finance.',
    homePath: '/mapa',
    highlights: [
      'Mapa de preços completo',
      'Lista de compras / orçamento WhatsApp',
      '3 scans NFC-e / mês',
      'Open Finance — 1 banco',
    ],
    featureFocus: 'price_map',
  },
  plus: {
    id: 'plus',
    audience: 'consumer',
    label: 'Plus',
    priceLabel: 'R$ 9,90',
    priceNote: '/ mês',
    landingBlurb: 'Mapa + limites e inteligência financeira leve.',
    homePath: '/dashboard',
    highlights: [
      'Tudo do Gratuito',
      'Dashboard financeiro',
      'Alertas e limites básicos',
      'Histórico ampliado',
    ],
    featureFocus: 'finance_light',
  },
  pro: {
    id: 'pro',
    audience: 'consumer',
    label: 'Pro',
    priceLabel: 'R$ 19,90',
    priceNote: '/ mês',
    landingBlurb: 'Open Finance avançado, radar, scanner e relatórios.',
    homePath: '/dashboard',
    highlights: [
      'Tudo do Plus',
      'Radar de ofertas',
      'Mais bancos Open Finance',
      'Scanner EAN e relatórios',
    ],
    featureFocus: 'finance_pro',
  },
  familia: {
    id: 'familia',
    audience: 'consumer',
    label: 'Família',
    priceLabel: 'R$ 29,90',
    priceNote: '/ mês',
    landingBlurb: 'Pro compartilhado com até 5 membros.',
    homePath: '/dashboard',
    highlights: [
      'Tudo do Pro',
      'Até 5 membros',
      'Painel familiar',
      'Bancos por membro',
    ],
    featureFocus: 'family',
  },
};

/** Planos B2B (landing + store_plans). */
export const MERCHANT_PLANS = {
  presenca_digital: {
    id: 'presenca_digital',
    audience: 'merchant',
    label: 'Presença Digital',
    priceLabel: 'a partir da vitrine',
    landingBlurb: 'Página da loja, QR e mapa de preços.',
    homeTab: 'ofertas',
    highlights: ['Página pública / QR', 'Mapa de preços', 'Cardápio digital'],
    featureFocus: 'presence',
  },
  pedidos_diretos: {
    id: 'pedidos_diretos',
    audience: 'merchant',
    label: 'Pedidos Diretos',
    priceLabel: 'pedidos + vitrine',
    landingBlurb: 'Pedidos pelo app/QR, retirada e entrega local.',
    homeTab: 'vendas',
    highlights: ['Pedidos QR', 'Retirada', 'Integração app consumidor'],
    featureFocus: 'orders',
  },
  estoque_margem: {
    id: 'estoque_margem',
    audience: 'merchant',
    label: 'Estoque e Margem',
    priceLabel: 'estoque + margem',
    landingBlurb: 'Controle de estoque por código de barras e margem.',
    homeTab: 'insumos',
    highlights: ['Estoque / insumos', 'Importar notas', 'Relatórios de margem'],
    featureFocus: 'inventory',
  },
  gestao_completa: {
    id: 'gestao_completa',
    audience: 'merchant',
    label: 'Gestão Completa',
    priceLabel: 'R$ 50,00',
    priceNote: '/ mês (landing)',
    landingBlurb: 'Pacote completo do pequeno varejo (estoque, pedidos, campanhas).',
    homeTab: 'insumos',
    highlights: ['Tudo dos planos anteriores', 'Campanhas WhatsApp', 'Histórico financeiro'],
    featureFocus: 'full',
  },
};

export function getConsumerPlan(id) {
  const key = String(id || 'free').toLowerCase();
  return CONSUMER_PLANS[key] || CONSUMER_PLANS.free;
}

export function getMerchantPlan(id) {
  const key = String(id || '').toLowerCase();
  return MERCHANT_PLANS[key] || null;
}

export function isConsumerPlanId(id) {
  return Object.prototype.hasOwnProperty.call(CONSUMER_PLANS, String(id || '').toLowerCase());
}

export function isMerchantPlanId(id) {
  return Object.prototype.hasOwnProperty.call(MERCHANT_PLANS, String(id || '').toLowerCase());
}

export function retailerAppBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_RETAILER_APP_URL ||
    process.env.FINMEMORY_RETAILER_CLOUD_RUN_URL ||
    'https://finmemorycomerciantes-836908221936.southamerica-east1.run.app';
  return String(raw).replace(/\/$/, '');
}

/**
 * Destino pós-login / reabrir app.
 * @param {{ preferred_audience?: string|null, preferred_plan?: string|null, plan_trial_ends_at?: string|null }} prefs
 */
export function resolveAppHomePath(prefs = {}) {
  const audience = String(prefs.preferred_audience || '').toLowerCase();
  const plan = String(prefs.preferred_plan || '').toLowerCase();
  if (!audience || !plan) return '/inicio';

  const trialEnds = prefs.plan_trial_ends_at ? new Date(prefs.plan_trial_ends_at) : null;
  const trialOk = !trialEnds || trialEnds.getTime() > Date.now();
  if (!trialOk) return '/inicio?trial=expired';

  if (audience === 'merchant') {
    const mp = getMerchantPlan(plan);
    const tab = mp?.homeTab || 'insumos';
    const base = retailerAppBaseUrl();
    return `${base}/parceiros?trial_plan=${encodeURIComponent(plan)}&tab=${encodeURIComponent(tab)}`;
  }

  if (audience === 'consumer') {
    return getConsumerPlan(plan).homePath || '/dashboard';
  }

  return '/inicio';
}

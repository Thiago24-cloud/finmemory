/**
 * Passos do UX Tutorial — copy em .context/onboarding-features.md
 */

/** @typedef {'top' | 'bottom' | 'left' | 'right'} HandPlacement */

/**
 * @typedef {Object} FeatureTourStep
 * @property {string} id
 * @property {string} targetId
 * @property {string} modalTitle
 * @property {string} modalBody
 * @property {HandPlacement} [handPlacement]
 * @property {boolean} [navigateOnFinish]
 */

/** IDs liberados por fase de rollout (fase 1 = só Caça-Preço consumidor). */
export const RELEASED_STEP_IDS = {
  consumer: ['caca-preco', 'escanear'],
  retailer: [],
};

/** @type {FeatureTourStep[]} */
export const CONSUMER_FEATURE_TOUR_STEPS = [
  {
    id: 'caca-preco',
    targetId: 'dashboard-mapa',
    modalTitle: '🗺️ Mapa Caça-Preço',
    modalBody:
      'Economize tempo e dinheiro! Veja em tempo real quais supermercados e lojas da sua região estão com os menores preços para os produtos que você quer comprar hoje. Não gaste a mais à toa!',
    handPlacement: 'top',
  },
  {
    id: 'escanear',
    targetId: 'dashboard-scan',
    modalTitle: '📸 Entrada por Foto',
    modalBody:
      'Esqueça a digitação manual. Tire uma foto de qualquer nota fiscal e nossa inteligência artificial puxará automaticamente todos os produtos, preços e datas para organizar suas finanças num piscar de olhos.',
    handPlacement: 'bottom',
  },
  {
    id: 'simulador',
    targetId: 'dashboard-simulador',
    modalTitle: '🧠 Simulador de Poder de Compra',
    modalBody:
      'Entenda seu dinheiro de verdade. O simulador cruza o valor das suas faturas de cartão com o seu saldo atual via Pix e débito, te mostrando seu poder de compra real para você nunca mais se endividar.',
    handPlacement: 'bottom',
  },
  {
    id: 'missoes',
    targetId: 'dashboard-missions',
    modalTitle: '⚔️ O Jogo da Vida Real',
    modalBody:
      'Transforme suas finanças em um jogo! Cumpra missões diárias de economia, acompanhe seu progresso, suba de nível e ganhe recompensas reais enquanto cuida do seu bolso.',
    handPlacement: 'bottom',
  },
];

/** @type {FeatureTourStep[]} */
export const RETAILER_FEATURE_TOUR_STEPS = [
  {
    id: 'mapa-intel',
    targetId: 'dashboard-mapa',
    modalTitle: '📊 Inteligência de Mercado',
    modalBody:
      'Acompanhe seus concorrentes. Veja em tempo real o preço praticado pela concorrência na sua região e ajuste suas ofertas de forma estratégica para atrair mais clientes para a sua loja.',
    handPlacement: 'top',
  },
  {
    id: 'lista',
    targetId: 'dashboard-lista',
    modalTitle: '🛒 Vitrine de Ofertas',
    modalBody:
      'Gerencie os produtos cadastrados da sua loja que aparecem no mapa. Itens enviados por usuários vão para uma fila de aprovação pendente para você ter controle total sobre a veracidade dos seus preços na plataforma.',
    handPlacement: 'bottom',
  },
  {
    id: 'relatorios',
    targetId: 'dashboard-relatorios',
    modalTitle: '📉 Análise de Retenção e Vendas',
    modalBody:
      'Monitore o comportamento dos consumidores da sua região. Descubra quais produtos são mais buscados, quais dias têm maior volume de procura e crie estratégias para reter clientes locais.',
    handPlacement: 'bottom',
  },
];

/**
 * @param {boolean} isRetailer
 * @returns {FeatureTourStep[]}
 */
export function getFeatureTourSteps(isRetailer) {
  const all = isRetailer ? RETAILER_FEATURE_TOUR_STEPS : CONSUMER_FEATURE_TOUR_STEPS;
  const released = isRetailer ? RELEASED_STEP_IDS.retailer : RELEASED_STEP_IDS.consumer;
  return all.filter((s) => released.includes(s.id));
}

/** Mapeamento atalho DashboardQuickAccess → data-tour-id */
export const QUICK_ACCESS_TOUR_IDS = {
  mapa: 'dashboard-mapa',
  scan: 'dashboard-scan',
  simulador: 'dashboard-simulador',
  missoes: 'dashboard-missions',
  lista: 'dashboard-lista',
  relatorios: 'dashboard-relatorios',
  barcode: 'dashboard-barcode',
  extrato: 'dashboard-extrato',
};

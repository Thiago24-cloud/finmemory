/**
 * Catálogo de passos — consumidor (intro + coach contínuo).
 * Fonte narrativa: .context/onboarding-features.md + produto.
 */

/** @typedef {'top' | 'bottom' | 'left' | 'right'} HandPlacement */

/**
 * @typedef {Object} CoachStep
 * @property {string} id
 * @property {string} featureId — chave em feature_last_used
 * @property {string} targetId
 * @property {string} modalTitle
 * @property {string} modalBody
 * @property {string} [mascotLine]
 * @property {HandPlacement} [handPlacement]
 * @property {boolean} [showMascot]
 * @property {boolean} [navigateOnFinish]
 */

/** Ordem da introdução — um passo por visita ao dashboard. */
export const CONSUMER_INTRO_STEP_ORDER = [
  'caca-preco',
  'escanear',
  'barcode',
  'missoes',
  'extrato',
  'simulador',
  'mascot',
];

/** Prioridade para reengajamento (feature menos usada). */
export const CONSUMER_COACH_PRIORITY = [
  'mapa',
  'barcode',
  'scan',
  'missoes',
  'extrato',
  'simulador',
];

/** @type {Record<string, CoachStep>} */
export const CONSUMER_COACH_STEPS = {
  'caca-preco': {
    id: 'caca-preco',
    featureId: 'mapa',
    targetId: 'dashboard-mapa',
    modalTitle: '🗺️ Mapa Caça-Preço',
    modalBody:
      'Economize tempo e dinheiro! Veja em tempo real quais supermercados e lojas da sua região estão com os menores preços para os produtos que você quer comprar hoje. Não gaste a mais à toa!',
    mascotLine: 'Começa por aqui — eu te mostro onde está mais barato!',
    handPlacement: 'top',
    showMascot: true,
  },
  escanear: {
    id: 'escanear',
    featureId: 'scan',
    targetId: 'dashboard-scan',
    modalTitle: '📸 Tire foto da sua nota',
    modalBody:
      'Esqueça a digitação manual. Tire uma foto de qualquer nota fiscal e nossa inteligência artificial puxará automaticamente todos os produtos, preços e datas para organizar suas finanças num piscar de olhos.',
    mascotLine: 'É só apontar a câmera — eu organizo o resto.',
    handPlacement: 'bottom',
    showMascot: true,
  },
  barcode: {
    id: 'barcode',
    featureId: 'barcode',
    targetId: 'dashboard-barcode',
    modalTitle: '📦 Código de barras',
    modalBody:
      'Escaneie o código de barras na hora da compra e saiba na hora o que você está levando — compare preços e evite surpresas no caixa.',
    mascotLine: 'Bipou o produto? Eu te ajudo a entender se vale a pena.',
    handPlacement: 'bottom',
    showMascot: true,
  },
  missoes: {
    id: 'missoes',
    featureId: 'missoes',
    targetId: 'dashboard-missions',
    modalTitle: '⚔️ O Jogo da Vida Real',
    modalBody:
      'Transforme suas finanças em um jogo! Cumpra missões diárias de economia, acompanhe seu progresso, suba de nível e ganhe recompensas reais enquanto cuida do seu bolso.',
    mascotLine: 'Missão cumprida = XP no bolso. Bora?',
    handPlacement: 'bottom',
    showMascot: true,
  },
  extrato: {
    id: 'extrato',
    featureId: 'extrato',
    targetId: 'dashboard-extrato',
    modalTitle: '📊 Seu extrato',
    modalBody:
      'Olhe seu extrato e veja como estão seus gastos — por mês, por loja e por categoria. Entender para onde vai o dinheiro é o primeiro passo para economizar de verdade.',
    mascotLine: 'Transparência total nos seus gastos, num só lugar.',
    handPlacement: 'bottom',
    showMascot: true,
  },
  simulador: {
    id: 'simulador',
    featureId: 'simulador',
    targetId: 'dashboard-simulador',
    modalTitle: '🧠 Simulador de Poder de Compra',
    modalBody:
      'Entenda seu dinheiro de verdade. O simulador cruza o valor das suas faturas de cartão com o seu saldo atual via Pix e débito, te mostrando seu poder de compra real para você nunca mais se endividar.',
    mascotLine: 'Cartão + Pix + débito — eu mostro o que sobra de verdade.',
    handPlacement: 'bottom',
    showMascot: true,
  },
  mascot: {
    id: 'mascot',
    featureId: 'mascot',
    targetId: 'dashboard-mascot',
    modalTitle: '👋 Eu sou seu guia',
    modalBody:
      'Sempre que precisar, estarei aqui em cima para te lembrar das melhores ferramentas do FinMemory — mapa de preços, nota fiscal, missões e muito mais. Toque em mim quando quiser uma dica!',
    mascotLine: 'Combinado? Vamos cuidar do seu bolso juntos.',
    handPlacement: 'bottom',
    showMascot: true,
  },
};

/**
 * @param {string} stepId
 * @returns {CoachStep | null}
 */
export function getConsumerCoachStep(stepId) {
  return CONSUMER_COACH_STEPS[stepId] || null;
}

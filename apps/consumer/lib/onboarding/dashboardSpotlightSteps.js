/** Passos do tutorial guiado (estilo Clash Royale) na Home / Dashboard. */
export const DASHBOARD_SPOTLIGHT_STEPS = [
  {
    id: 'missions',
    targetId: 'dashboard-missions',
    title: 'Missões do dia',
    body: 'Complete suas missões diárias para evoluir suas finanças e ganhar XP!',
    advance: 'click_target',
    blockNavigation: true,
    placement: 'bottom',
    mood: 'happy',
  },
  {
    id: 'month-carousel',
    targetId: 'dashboard-month-carousel',
    title: 'Histórico por mês',
    body: 'Altere entre os meses para acompanhar seu histórico e planejar seu fluxo de caixa.',
    advance: 'next_button',
    placement: 'bottom',
    mood: 'neutral',
  },
  {
    id: 'mapa',
    targetId: 'dashboard-mapa',
    title: 'Caça-Preço',
    body: 'Economize de verdade! Encontre os menores preços da sua região validados pela comunidade.',
    advance: 'click_target',
    finishOnAdvance: true,
    placement: 'top',
    mood: 'happy',
  },
];

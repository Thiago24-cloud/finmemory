/**
 * Falas rotativas por estado do mascote — evita cegueira de layout (padrão Duolingo).
 */

export const CHARACTER_STATES = [
  'OPEN_FINANCE_ANALYZE',
  'PRICE_MAP_HUNT',
  'META_BATIDA',
  'BUDGET_CRUNCH',
  'IDLE',
] as const;

export type CharacterStateId = (typeof CHARACTER_STATES)[number];

export const CHARACTER_SPEECHES: Record<CharacterStateId, string[]> = {
  OPEN_FINANCE_ANALYZE: [
    'Contas conectadas! Deixa que eu fico de olho no relatório por você.',
    'Analisando os gastos por aqui... O gordinho tá chique e organizado!',
    'Tudo integrado! Vamos ver para onde o seu dinheiro está indo hoje.',
    'Open Finance ligado — agora é só acompanhar o jogo financeiro.',
  ],
  PRICE_MAP_HUNT: [
    'Hora de economizar! Bora caçar o mercado mais barato da região?',
    'Se vir algum preço bom por aí, me avisa para eu atualizar o mapa!',
    'Não vamos rasgar dinheiro hoje, hein? Dá uma olhada no mapa antes.',
    'Modo caçador de ofertas ativado. Bora vencer no preço!',
  ],
  META_BATIDA: [
    'Meta batida! Assim meu coração não aguenta de orgulho!',
    'Economizou demais! Ganhamos bônus de pontuação hoje.',
    'Dinheiro na conta e meta no azul. Esquece, tá voando!',
    'Missões do dia concluídas — você é craque!',
  ],
  BUDGET_CRUNCH: [
    'Epa... o limite tá quase ali. Vamos dar uma segurada?',
    'Várias contas abertas para vencer... foco na economia esta semana!',
    'Abri o relatório e quase caí para trás. Segura esse dedo aí!',
    'Gastos subindo — bora respirar e replanejar antes do fim do mês.',
  ],
  IDLE: [
    'Bora organizar as finanças? Um passo por dia já vale ouro.',
    'Tô por aqui quando precisar — escaneia uma nota ou abre o mapa!',
    'FinMemory na área. O que vamos conquistar hoje?',
  ],
};

export function pickRandomSpeech(state: CharacterStateId): string {
  const list = CHARACTER_SPEECHES[state] || CHARACTER_SPEECHES.IDLE;
  return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

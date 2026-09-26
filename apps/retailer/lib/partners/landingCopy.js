/** Copywriting — landing FinMemory Comerciantes (wireframe + design). */

export const PARTNERS_HERO = {
  brand: 'FinMemory',
  title: 'Controle seu negócio com mais clareza, economia e lucro',
  subtitle:
    'Organize compras, estoque e vendas em um só app. Entenda seu lucro real e tome decisões melhores.',
  ctaPrimary: 'Quero testar o app',
  ctaSecondary: 'Ver como funciona',
};

export const PARTNERS_PROBLEM = {
  title: 'Você ainda controla seu negócio no caderno, na cabeça ou pelo WhatsApp?',
  intro: 'Muitos pequenos negócios perdem dinheiro porque não sabem exatamente:',
  items: [
    'quanto estão vendendo',
    'quanto estão gastando',
    'qual produto dá mais lucro',
    'quando o estoque está acabando',
    'onde comprar mais barato (mercados e atacados)',
  ],
};

export const PARTNERS_OFFERS_SECTION = {
  title: 'O que o app faz por você',
};

export const PARTNERS_BENEFITS = [
  {
    icon: 'map',
    title: 'Comparar preços',
    body: 'Veja preços em mercados e atacados na sua região e reduza o custo dos insumos.',
  },
  {
    icon: 'stock',
    title: 'Controlar estoque',
    body: 'Veja o que entra, sai e está acabando. Evite falta de mercadoria e compras desnecessárias.',
  },
  {
    icon: 'sales',
    title: 'Registrar vendas',
    body: 'Acompanhe suas vendas do dia, o faturamento e quais produtos trazem mais resultado.',
  },
  {
    icon: 'profit',
    title: 'Entender lucro real',
    body: 'Veja o que realmente sobra. Visualize custos, vendas e margens sem complicação.',
  },
  {
    icon: 'insights',
    title: 'Tomar decisões com dados',
    body: 'Use insights simples para saber quando comprar, onde economizar e o que priorizar.',
  },
];

export const PARTNERS_STEPS = [
  {
    step: '1',
    title: 'Cadastre seus produtos',
    body: 'Coloque os itens que você compra e vende.',
  },
  {
    step: '2',
    title: 'Registre compras e vendas',
    body: 'Acompanhe tudo de forma simples.',
  },
  {
    step: '3',
    title: 'Veja seu lucro e tome decisões melhores',
    body: 'Entenda onde economizar e onde ganhar mais.',
  },
];

export const PARTNERS_AUDIENCE = {
  title: 'Feito para quem vende todo dia',
  items: [
    'Ambulantes',
    'Lanchonetes',
    'Docerias',
    'Marmitarias',
    'Pequenos mercados',
    'Negócios locais',
    'Restaurantes',
    'Comerciantes',
  ],
};

export const PARTNERS_PLANS_SECTION = {
  title: 'Escolha o pacote do seu negócio',
  subtitle: 'Comece simples. Cresça quando fizer sentido.',
};

export const PARTNERS_PLANS = [
  {
    id: 'compra',
    name: 'FinMemory Compra',
    audience: 'Para autônomos e ambulantes',
    tagline: 'Economize antes de vender.',
    price: 'R$ 29,90',
    priceNote: '/mês',
    features: [
      { label: 'Mapa de preços (mercados e atacados)' },
      { label: 'Lista de compras inteligente' },
      { label: 'Alertas no WhatsApp/app' },
      { label: 'Relatório de economia', soon: true },
    ],
    highlighted: false,
  },
  {
    id: 'controle',
    name: 'FinMemory Controle',
    audience: 'Para pequenos negócios',
    tagline: 'Pare de perder dinheiro no estoque.',
    price: 'R$ 59,90',
    priceNote: '/mês',
    features: [
      { label: 'Controle de estoque' },
      { label: 'Entradas e saídas' },
      { label: 'Alertas de falta' },
      { label: 'Histórico de compras' },
      { label: 'Mapa de preços (mercados e atacados)' },
      { label: 'Relatório de perdas', soon: true },
    ],
    highlighted: false,
  },
  {
    id: 'operacao',
    name: 'FinMemory Operação',
    audience: 'Para negócios de alimentação',
    tagline: 'Venda e opere pelo celular.',
    price: 'R$ 85,00',
    priceNote: '/mês',
    features: [
      { label: 'Estoque' },
      { label: 'Cardápio QR Code' },
      { label: 'Pedidos' },
      { label: 'Cozinha digital' },
      { label: 'Papel zero' },
      { label: 'Mapa de preços (mercados e atacados)' },
      { label: 'Relatórios', soon: true },
    ],
    highlighted: true,
  },
  {
    id: 'inteligencia',
    name: 'FinMemory Inteligência',
    audience: 'Para quem quer crescer com dados',
    tagline: 'Decida como empresa grande, pagando como pequeno.',
    price: 'a partir de R$ 149,90',
    priceNote: '/mês',
    features: [
      { label: 'Comparação avançada de preços (mercados e atacados)' },
      { label: 'IA de compras', soon: true },
      { label: 'CMV', soon: true },
      { label: 'Margem por produto', soon: true },
      { label: 'Sugestão de preço de venda', soon: true },
      { label: 'Previsão de reposição', soon: true },
    ],
    highlighted: false,
  },
];

export const PARTNERS_CLOSING = {
  title: 'Menos bagunça. Mais controle. Mais lucro.',
  body: [
    'Pare de depender da memória, do caderno ou de anotações perdidas no WhatsApp.',
    'Tenha uma visão clara do seu negócio e tome decisões com mais segurança todos os dias.',
  ],
  lines: ['Seu negócio merece mais controle.', 'Você merece vender com mais inteligência.'],
  cta: 'Quero testar o app',
};

export const PARTNERS_FORM = {
  title: 'Quero testar o app',
  subtitle:
    'Crie sua conta com Google ou e-mail e acesse o painel. Os dados da loja ficam para configurar depois.',
  submit: 'Criar conta e acessar o painel',
  successTitle: 'Conta criada!',
  successBody:
    'Sua conta foi criada. Faça login para acessar o painel, organizar compras, estoque, vendas e lucro.',
};

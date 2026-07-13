export const CATEGORY_DEFINITIONS = [
  {
    key: 'cerveja',
    label: 'Cerveja',
    keywords: ['cerveja', 'chopp', 'chope', 'pilsen', 'lager', 'ipa'],
  },
  {
    key: 'refrigerante',
    label: 'Refrigerante',
    keywords: [
      'refrigerante',
      'refri',
      'coca',
      'guarana',
      'guaraná',
      'soda',
      'fanta',
      'sprite',
      'pepsi',
    ],
  },
  {
    key: 'agua',
    label: 'Água',
    keywords: ['agua', 'água', 'mineral'],
  },
  {
    key: 'leite',
    label: 'Leite',
    keywords: ['leite', 'iogurte', 'yogurte'],
  },
  {
    key: 'arroz',
    label: 'Arroz',
    keywords: ['arroz'],
  },
  {
    key: 'feijao',
    label: 'Feijão',
    keywords: ['feijao', 'feijão'],
  },
  {
    key: 'pao',
    label: 'Pão',
    keywords: ['pao', 'pão', 'baguete', 'padaria'],
  },
  {
    key: 'limpeza',
    label: 'Limpeza',
    keywords: [
      'detergente',
      'sabao',
      'sabão',
      'desinfetante',
      'limpeza',
      'amaciante',
      'sanitaria',
      'sanitária',
      'alvejante',
      'multiuso',
    ],
  },
  {
    key: 'higiene',
    label: 'Higiene',
    keywords: [
      'sabonete',
      'shampoo',
      'xampu',
      'condicionador',
      'creme dental',
      'escova de dente',
      'papel higienico',
      'papel higiênico',
      'higiene',
      'absorvente',
      'fralda',
      'desodorante',
    ],
  },
  {
    key: 'generico',
    label: 'Outros',
    keywords: [],
  },
];

export const DEFAULT_CATEGORY_KEY = 'generico';

export function matchCategoryByName(name) {
  const normalized = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const category of CATEGORY_DEFINITIONS) {
    if (category.key === DEFAULT_CATEGORY_KEY) continue;
    for (const keyword of category.keywords) {
      const normalizedKeyword = keyword
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (normalized.includes(normalizedKeyword)) {
        return category.key;
      }
    }
  }

  return DEFAULT_CATEGORY_KEY;
}

export function getCategoryLabel(key) {
  return CATEGORY_DEFINITIONS.find((c) => c.key === key)?.label || 'Outros';
}

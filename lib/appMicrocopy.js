/**
 * Microcopy curto — app FinMemory (utilizador).
 * Rótulos de filtro, nav e atalhos: preferir daqui para manter tom e menos palavras.
 */
export const BRAND_APP_NAME = 'FinMemory';

/** Lista de compras — chips de filtro */
export const SHOPPING_LIST_FILTER_STATUS = [
  { value: 'all', label: 'Tudo' },
  { value: 'pending', label: 'A fazer' },
  { value: 'checked', label: 'Feito' },
];

export const SHOPPING_LIST_FILTER_PERIOD = [
  { value: 'all', label: 'Sempre' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês ant.' },
];

export const SHOPPING_LIST_FILTER_UI = {
  toggleButton: 'Filtrar',
  filtersOnBadge: '✓',
  sectionSituation: 'Situação',
  sectionWhen: 'Quando',
};

/** Gastos / relatórios — seletor de mês */
export const MONTH_FILTER = {
  label: 'Mês',
  allMonths: 'Todos',
};

/** Dashboard */
export const DASHBOARD = {
  quickSectionTitle: 'Atalhos',
  trashSubtitle: 'Restaurar o que apagou.',
  historySearchPlaceholder: 'Buscar histórico…',
  historySearchAria: 'Buscar histórico',
};

/** Barra inferior */
export const BOTTOM_NAV = {
  map: 'Mapa',
  spending: 'Gastos',
  simulador: 'Simular',
  profile: 'Perfil',
  scanAria: 'Escanear NF-e',
};

/** Títulos (title) dos atalhos — tooltips curtos */
export const QUICK_ACTION_TITLE = {
  simulador: 'Saldo e crédito',
  barcode: 'Ler código',
};

/** Mapa — aria-labels e placeholders curtos */
export const MAP_ARIA = {
  plannerMenu: 'Menu de compras',
  plannerMenuWaze: 'Menu Waze',
  menuMobileWaze: 'Menu Waze',
  searchMap: 'Buscar mapa',
  locateMe: 'Minha posição',
};

export const MAP_PLACEHOLDERS = {
  planningList: 'Lista: arroz, carne…',
  searchShort: 'Ofertas, lojas…',
  searchLong: 'Buscar no mapa',
};

/** Chips de categoria no mapa (rótulos curtos) */
export const MAP_CHIPS = {
  todos: 'Tudo',
  dia: 'DIA',
  hortifruti: 'Hortifruti',
  mercearia: 'Mercearia',
  bebidas: 'Bebidas',
  congelados: 'Frios',
  cuidados: 'Pessoal',
  limpeza: 'Limpeza',
  barcode: 'Barras',
  favoritos: 'Lista',
};

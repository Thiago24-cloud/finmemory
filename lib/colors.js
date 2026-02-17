/**
 * Cores vivas do FinMemory – destaque estratégico por tipo de comércio.
 * Usado no mapa (pins, popups), no histórico (Gastos) e em relatórios.
 */

/** Cores vivas por tipo de estabelecimento – destaque estratégico (restaurante, lanchonete, mercado, etc.) */
export const CATEGORY_COLORS = {
  supermercado: { main: '#D32F2F', bg: '#FFEBEE', label: 'Supermercado' },
  mercado:      { main: '#D32F2F', bg: '#FFEBEE', label: 'Mercado' },
  restaurante:  { main: '#F57C00', bg: '#FFF3E0', label: 'Restaurante' },
  lanchonete:   { main: '#FF9800', bg: '#FFF8E1', label: 'Lanchonete' },
  padaria:      { main: '#795548', bg: '#EFEBE9', label: 'Padaria' },
  farmácia:     { main: '#00796B', bg: '#E0F2F1', label: 'Farmácia' },
  bar:          { main: '#512DA8', bg: '#EDE7F6', label: 'Bar' },
  açougue:      { main: '#B71C1C', bg: '#FFEBEE', label: 'Açougue' },
  posto:        { main: '#0D47A1', bg: '#E3F2FD', label: 'Posto' },
  combustível:  { main: '#0D47A1', bg: '#E3F2FD', label: 'Combustível' },
  eletrônicos:  { main: '#01579B', bg: '#E1F5FE', label: 'Eletrônicos' },
  roupas:       { main: '#880E4F', bg: '#FCE4EC', label: 'Roupas' },
  vestuário:    { main: '#880E4F', bg: '#FCE4EC', label: 'Vestuário' },
  serviços:     { main: '#4A148C', bg: '#F3E5F5', label: 'Serviços' },
  transporte:  { main: '#004D40', bg: '#E0F2F1', label: 'Transporte' },
  uber:         { main: '#263238', bg: '#ECEFF1', label: 'Uber' },
  alimentação:  { main: '#E65100', bg: '#FFF8E1', label: 'Alimentação' },
  default:      { main: '#2E7D32', bg: '#E8F5E9', label: 'Outros' },
};

/**
 * Retorna a cor do tipo de comércio (main e bg) a partir de categoria/nome.
 */
export function getCategoryColor(category, merchantName = '') {
  const text = `${(category || '')} ${(merchantName || '')}`.toLowerCase();
  for (const [key, colors] of Object.entries(CATEGORY_COLORS)) {
    if (key === 'default') continue;
    if (text.includes(key)) return colors;
  }
  return CATEGORY_COLORS.default;
}

/** Chave no localStorage para o tema do mapa escolhido */
export const MAP_THEME_STORAGE_KEY = 'finmemory_map_theme';

/**
 * Temas do mapa – tons de cor do fundo do mapa (TileLayer).
 * A pessoa clica em "Mapas" e escolhe um dos estilos.
 */
/** Tons do mapa – pasta "Mapas": usuário clica e escolhe o visual (como subpasta que complementa a tela principal). */
export const MAP_THEMES = [
  { id: 'claro', name: 'Claro', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', preview: '#F5F5F5' },
  { id: 'ruas', name: 'Ruas', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', preview: '#E8E4E0' },
  { id: 'escuro', name: 'Escuro', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', preview: '#1E1E1E' },
  { id: 'verde', name: 'Verde', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', preview: '#C8E6C9' },
  { id: 'azul', name: 'Azul (água)', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', preview: '#BBDEFB' },
  { id: 'satelite', name: 'Satélite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', preview: '#455A64' },
];

export function getMapThemeById(id) {
  return MAP_THEMES.find((t) => t.id === id) || MAP_THEMES[0];
}

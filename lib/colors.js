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

/** Paleta para categorias sem palavra-chave — cores bem distintas (determinísticas por texto). */
const DYNAMIC_FALLBACK = [
  { main: '#2563EB', bg: '#EFF6FF' },
  { main: '#7C3AED', bg: '#F5F3FF' },
  { main: '#DB2777', bg: '#FDF2F8' },
  { main: '#0891B2', bg: '#ECFEFF' },
  { main: '#059669', bg: '#ECFDF5' },
  { main: '#4F46E5', bg: '#EEF2FF' },
  { main: '#CA8A04', bg: '#FEFCE8' },
  { main: '#BE185D', bg: '#FDF2F8' },
  { main: '#0D9488', bg: '#F0FDFA' },
  { main: '#B45309', bg: '#FFFBEB' },
  { main: '#65A30D', bg: '#F7FEE7' },
  { main: '#9333EA', bg: '#FAF5FF' },
  { main: '#E11D48', bg: '#FFF1F2' },
  { main: '#0284C7', bg: '#F0F9FF' },
];

/** Variações de vermelho/laranja para supermercado/mercado — mesmo “tipo” mas pins mais distintos no mapa. */
const SUPERMARKET_PIN_VARIANTS = [
  '#B71C1C', '#C62828', '#D32F2F', '#E53935', '#F4511E', '#FB8C00', '#F57C00', '#E65100',
];

function hashStringToIndex(seed, modulo) {
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h) % modulo;
}

/**
 * Retorna a cor do tipo de comércio (main e bg) a partir de categoria/nome.
 * Promoções e encartes têm cor própria; supermercado/mercado variam por loja+categoria;
 * “Outros” usa paleta dinâmica em vez de um único verde.
 */
export function getCategoryColor(category, merchantName = '') {
  const text = `${(category || '')} ${(merchantName || '')}`.toLowerCase();

  // Antes de “supermercado” genérico — encartes/promos com cor própria
  if (/\b(promo|promoç|promoção|encarte|oferta)\b/.test(text) && !/\bsem\s+(promo|oferta)\b/i.test(text)) {
    return { main: '#9333EA', bg: '#F3E8FF', label: 'Promoção' };
  }

  for (const [key, colors] of Object.entries(CATEGORY_COLORS)) {
    if (key === 'default') continue;
    if (text.includes(key)) {
      if (key === 'supermercado' || key === 'mercado') {
        const idx = hashStringToIndex(`${category || ''}\0${merchantName || ''}`, SUPERMARKET_PIN_VARIANTS.length);
        return { ...colors, main: SUPERMARKET_PIN_VARIANTS[idx] };
      }
      if (key === 'restaurante' || key === 'lanchonete' || key === 'alimentação') {
        const warm = ['#E65100', '#F57C00', '#FB8C00', '#FF9800', '#F9A825', '#FDD835'];
        const wi = hashStringToIndex(`${category || ''}\0${merchantName || ''}`, warm.length);
        return { ...colors, main: warm[wi] };
      }
      if (key === 'farmácia' || key === 'padaria') {
        const cool = key === 'farmácia'
          ? ['#00695C', '#00796B', '#00897B', '#009688', '#26A69A']
          : ['#5D4037', '#6D4C41', '#795548', '#8D6E63', '#A1887F'];
        const ci = hashStringToIndex(`${category || ''}\0${merchantName || ''}`, cool.length);
        return { ...colors, main: cool[ci] };
      }
      return colors;
    }
  }

  const fi = hashStringToIndex(`${category || ''}\0${merchantName || ''}`, DYNAMIC_FALLBACK.length);
  const pick = DYNAMIC_FALLBACK[fi];
  return { main: pick.main, bg: pick.bg, label: CATEGORY_COLORS.default.label };
}

/** Tons por `stores.type` — pin principal no mapa (estilo aplicativo de mapas). */
const STORE_TYPE_PIN_PALETTES = {
  supermarket: ['#1A73E8', '#1967D2', '#1558B0', '#0D47A1', '#4285F4', '#039BE5', '#0277BD', '#00838F'],
  pharmacy: ['#0F766E', '#0D9488', '#0E7490', '#115E59', '#0891B2', '#047857', '#0D9488', '#134E4A'],
  bakery: ['#B45309', '#C2410C', '#D97706', '#CA8A04', '#A16207', '#EA580C', '#9A3412', '#F97316'],
  restaurant: ['#DC2626', '#E11D48', '#DB2777', '#EA580C', '#F43F5E', '#BE123C', '#B91C1C', '#C2185B'],
};

const STORE_PIN_GENERIC = [
  '#5B21B6', '#6D28D9', '#7C3AED', '#4338CA', '#4F46E5', '#6366F1',
  '#475569', '#64748B', '#0EA5E9', '#0284C7', '#92400E', '#15803D', '#A21CAF',
];

/**
 * Cor principal do pin de loja (teardrop + popup). Varia por loja dentro do mesmo tipo.
 * @param {string} [type] — ex.: supermarket, pharmacy, bakery, restaurant
 * @param {string} [stableKey] — ex.: id ou nome da loja
 */
export function getStorePinMainColor(type, stableKey = '') {
  const t = String(type || '').toLowerCase();
  const seed = `${t}\0${String(stableKey || '')}`;
  const pick = (arr) => arr[hashStringToIndex(seed, arr.length)];
  if (t === 'supermarket') return pick(STORE_TYPE_PIN_PALETTES.supermarket);
  if (t === 'pharmacy') return pick(STORE_TYPE_PIN_PALETTES.pharmacy);
  if (t === 'bakery') return pick(STORE_TYPE_PIN_PALETTES.bakery);
  if (t === 'restaurant') return pick(STORE_TYPE_PIN_PALETTES.restaurant);
  return pick(STORE_PIN_GENERIC);
}

/** Chave no localStorage para o tema do mapa escolhido */
export const MAP_THEME_STORAGE_KEY = 'finmemory_map_theme';

/**
 * Temas do mapa – tons de cor do fundo do mapa (TileLayer).
 * A pessoa clica em "Mapas" e escolhe um dos estilos.
 */
/** Tons do mapa – pasta "Mapas": usuário clica e escolhe o visual (como subpasta que complementa a tela principal). */
export const MAP_THEMES = [
  {
    id: 'padrao',
    name: 'Ruas em destaque',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    preview: '#e8e4de',
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, Maxar, Earthstar Geographics, GIS User Community',
  },
  {
    id: 'verde',
    name: 'Verde',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    preview: '#C8E6C9',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  {
    id: 'waze',
    name: 'Waze dos Preços',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    preview: '#13161f',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
];

export function getMapThemeById(id) {
  return MAP_THEMES.find((t) => t.id === id) || MAP_THEMES[0];
}

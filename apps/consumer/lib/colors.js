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

/** Paleta para categorias sem palavra-chave — tons distintos mas contidos (harmonia com o verde FinMemory). */
const DYNAMIC_FALLBACK = [
  { main: '#2F6FA7', bg: '#EDF4FA' },
  { main: '#5B6BB5', bg: '#F0F1FA' },
  { main: '#A64F72', bg: '#FAF0F4' },
  { main: '#2A8A9A', bg: '#ECF7F8' },
  { main: '#2E8B6E', bg: '#E8F6F1' },
  { main: '#4A5BA8', bg: '#EEF0FA' },
  { main: '#9A7A2E', bg: '#F9F6ED' },
  { main: '#955872', bg: '#F8F1F4' },
  { main: '#2D7D78', bg: '#EAF6F5' },
  { main: '#A16207', bg: '#FDF8EB' },
  { main: '#5C8F3A', bg: '#F2F7ED' },
  { main: '#6B4E9E', bg: '#F5F2FA' },
  { main: '#B3445E', bg: '#FBF0F3' },
  { main: '#2878A8', bg: '#EBF4FA' },
];

/** Variações para supermercado/mercado — terracota/rosa queimado (menos “alarme” que vermelho puro). */
const SUPERMARKET_PIN_VARIANTS = [
  '#A84A45', '#B3524D', '#B85C48', '#A8603E', '#9D5A42', '#C45C4A', '#A85640', '#8F5348',
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

  // Antes de “supermercado” genérico — encartes/promos (tom roxo contido, alinhado ao app)
  if (/\b(promo|promoç|promoção|encarte|oferta)\b/.test(text) && !/\bsem\s+(promo|oferta)\b/i.test(text)) {
    return { main: '#6B4E9E', bg: '#F3F0FA', label: 'Promoção' };
  }

  for (const [key, colors] of Object.entries(CATEGORY_COLORS)) {
    if (key === 'default') continue;
    if (text.includes(key)) {
      if (key === 'supermercado' || key === 'mercado') {
        const idx = hashStringToIndex(`${category || ''}\0${merchantName || ''}`, SUPERMARKET_PIN_VARIANTS.length);
        return { ...colors, main: SUPERMARKET_PIN_VARIANTS[idx] };
      }
      if (key === 'restaurante' || key === 'lanchonete' || key === 'alimentação') {
        const warm = ['#B85C38', '#C45E36', '#A8603E', '#B86832', '#A67228', '#9A7A2E'];
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

/** Tons por `stores.type` — variedade azul/verde/roxo/âmbar (pins distintos, sem ficar só “azul e marrom”). */
const STORE_TYPE_PIN_PALETTES = {
  supermarket: [
    '#2B6CB0', '#2E8B57', '#5B4B9A', '#2874A6', '#218575', '#4A5BA8', '#2F6FA7', '#6B4E9E',
    '#1B7F5A', '#3D6BB5', '#5A3D8C', '#2A7D8C', '#4472C4', '#528B3D', '#634AA8',
  ],
  pharmacy: ['#2D7D6E', '#2A8A7A', '#287870', '#246B63', '#2C6F64', '#1F6B5E', '#358A7C', '#2A665C'],
  bakery: ['#B8860B', '#A67C2E', '#9A7230', '#AD7E2E', '#8F6A28', '#A07830', '#967228', '#8B6914'],
  restaurant: ['#B54A52', '#A84855', '#C4564E', '#A85C48', '#B05058', '#9C4D50', '#A8604A', '#904A52'],
};

const STORE_PIN_GENERIC = [
  '#4A5F8F', '#2E8B57', '#6B4E9E', '#2A8A9A', '#5B4B9A', '#487A8C',
  '#3D8B5C', '#6B5088', '#2F6FA7', '#7A5E38', '#5568A0', '#218575', '#A64F72',
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
    mapboxStyleId: null,
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, Maxar, Earthstar Geographics, GIS User Community',
  },
  {
    id: 'verde',
    name: 'Verde',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    preview: '#C8E6C9',
    mapboxStyleId: null,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  {
    id: 'mapbox-streets',
    name: 'Mapbox — ruas claras',
    /** Fallback quando `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` não existe no build. */
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    preview: '#e4e4e7',
    mapboxStyleId: 'mapbox/streets-v12',
    attribution:
      '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    id: 'waze',
    name: 'Waze dos Preços',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    preview: '#13161f',
    mapboxStyleId: null,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
];

export function getMapThemeById(id) {
  return MAP_THEMES.find((t) => t.id === id) || MAP_THEMES[0];
}

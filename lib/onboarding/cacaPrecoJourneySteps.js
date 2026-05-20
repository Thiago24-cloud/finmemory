/**
 * Roteiro da jornada gamificada — Modo Caça-Preço no mapa.
 * Textos fixos conforme spec do produto.
 */

/** @typedef {'intro' | 'gps_cta' | 'store_found' | 'pick_products' | 'ready_route'} CacaPrecoSceneId */

/** @type {Record<CacaPrecoSceneId, { autoAdvanceMs?: number }>} */
export const CACA_PRECO_SCENE_META = {
  intro: { autoAdvanceMs: 4500 },
  gps_cta: {},
  store_found: {},
  pick_products: {},
  ready_route: {},
};

export const CACA_PRECO_SCENE_INTRO_TEXT =
  'FINMEMORY: Ótimo! O Modo Caça-Preço é usado para encontrar e aproveitar as melhores ofertas.';

export const CACA_PRECO_SCENE_GPS_TEXT =
  'Clique no ícone de localização para aproximar e ver as ofertas perto de você.';

/**
 * @param {{ userName?: string | null, storeName?: string | null }} ctx
 */
export function cacaPrecoStoreFoundText({ userName, storeName }) {
  const first = firstNameFromDisplayName(userName);
  const store = String(storeName || 'supermercado parceiro').trim() || 'supermercado parceiro';
  if (first) {
    return `${first}, olha os produtos disponíveis do dia e aproveite de acordo com o ${store}.`;
  }
  return `Olha os produtos disponíveis do dia e aproveite de acordo com o ${store}.`;
}

export const CACA_PRECO_SCENE_READY_ROUTE_TEXT =
  'Pronto! Lista salva. Vamos traçar o caminho agora?';

function firstNameFromDisplayName(name) {
  const s = String(name || '').trim();
  if (!s) return null;
  return s.split(/\s+/)[0] || null;
}

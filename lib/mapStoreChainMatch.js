/**
 * Associação oferta ↔ loja no mapa: exige que a rede do ponto bata com o nome do estabelecimento,
 * não só proximidade (evita DIA em Hirota/Mambo etc.).
 */

export function normalizeMapChainText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distância máxima (km) ponto promocional ↔ pin da loja — partilhada por /api/map/stores e store-offers. */
export function getPromoStoreMatchMaxKm() {
  const n = Number.parseFloat(
    typeof process !== 'undefined' && process.env?.MAP_PROMO_STORE_MATCH_KM != null
      ? process.env.MAP_PROMO_STORE_MATCH_KM
      : '0.45'
  );
  if (!Number.isFinite(n) || n < 0.05) return 0.45;
  return Math.min(n, 2);
}

/**
 * Slug vindo de `promocoes_supermercados.supermercado` ou inferido de `price_points.store_name`.
 * @param {string | null | undefined} slug
 * @returns {boolean}
 */
export function storeNormalizedMatchesChainSlug(normalizedStoreName, slug) {
  const n = normalizeMapChainText(normalizedStoreName);
  const s = String(slug || '')
    .toLowerCase()
    .trim();
  if (!n || !s) return false;

  const tests = {
    armazemdocampo: () => n.includes('armazem do campo'),
    paodeacucar: () =>
      n.includes('pao de acucar') ||
      n.includes('minuto pao') ||
      n.includes('minuto mercado') ||
      n.includes('mercado minuto'),
    saojorge: () =>
      n === 'saojorge' || n.includes('sao jorge') || n.includes('sacolao sao jorge'),
    carrefour: () => n.includes('carrefour') || n.includes('atacado carrefour'),
    assai: () => n.includes('assai') || n.includes('assaí'),
    hirota: () => /\bhirota\b/.test(n),
    /** Curadoria / agente usam slug fixo; `stores.js` passa só o slug como store_name do ponto. */
    pomardavilavilamadalena: () =>
      n === 'pomardavilavilamadalena' ||
      (n.includes('pomar') && (n.includes('vila') || n.includes('madalena'))),
    mambo: () => /\bmambo\b/.test(n),
    lopes: () => /\blopes\b/.test(n),
    sonda: () => /\bsonda\b/.test(n),
    agape: () => /\bagape\b/.test(n) || n.includes('agape'),
    /**
     * Supermercado Padrão — padraosuper.com.br.
     * Cadastros/OSM às vezes vêm só como “Padrão · Filial X” (sem “mercado” no texto).
     * Evitar padaria / panificadora.
     */
    padraosuper: () => {
      if (n.includes('padraosuper')) return true;
      if (n.includes('padaria') || n.includes('panificadora')) return false;
      if (!n.includes('padrao')) return false;
      if (
        n.includes('supermercado') ||
        n.includes('mercado') ||
        n.includes('supermercados') ||
        n.includes('hipermercado') ||
        n.includes('atacado') ||
        n.includes('atacadista')
      ) {
        return true;
      }
      /* Nome curto tipo “Padrão - Pinheiros” (sem “mercado” no cadastro) */
      if (/^padrao(\s+|-|\s*·\s*|\s*\|\s*)/.test(n)) return true;
      if (n.includes('rede padrao') || n.includes('grupo padrao')) return true;
      return false;
    },
    dia: () => /\bdia\b/.test(n) && !/\bhirota\b/.test(n),
  };

  const fn = tests[s];
  return typeof fn === 'function' ? fn() : false;
}

/** Ordem importa: redes mais específicas antes de nomes genéricos. */
const CHAIN_SLUG_ORDER = [
  'armazemdocampo',
  'paodeacucar',
  'saojorge',
  'carrefour',
  'assai',
  'hirota',
  'pomardavilavilamadalena',
  'mambo',
  'lopes',
  'sonda',
  'agape',
  'padraosuper',
  'dia',
];

/**
 * Infere slug a partir do texto salvo no mapa (import GPT, "Mambo · ofertas", etc.).
 * @param {string | null | undefined} storeName
 * @returns {string | null}
 */
export function inferChainSlugFromPromoStoreName(storeName) {
  const n = normalizeMapChainText(storeName);
  if (!n) return null;
  for (const slug of CHAIN_SLUG_ORDER) {
    if (storeNormalizedMatchesChainSlug(n, slug)) return slug;
  }
  return null;
}

/** Mesma lógica que `inferChainSlugFromPromoStoreName`, para o nome do pin em `stores.name`. */
export const inferChainSlugFromStoreDisplayName = inferChainSlugFromPromoStoreName;

/**
 * Quando não há slug (divulgação manual), só liga por proximidade se o nome da loja e o do ponto forem claramente o mesmo estabelecimento.
 */
/** Títulos de UI capturados como “produto” em scrapers ruidosos. */
export function isLikelyNonProductScraperTitle(name) {
  const n = normalizeMapChainText(name);
  if (!n || n.length < 2) return true;
  if (/\bmumble\b/.test(n)) return true;
  if (/\bclick\s+and\s+collect\b/.test(n)) return true;
  /* Scrapers gravam linhas de serviço (ex.: "Mambo — Clique e Retire") como "produto". */
  if (/\bclique\s+e\s+retire\b/.test(n)) return true;
  if (/^supermarket\s+mumble\b/.test(n)) return true;
  /* Banners de e-commerce: entrega, agendamento, etc. */
  if (/\bentrega agendada\b/.test(n)) return true;
  if (/\bentrega\s+rapida\b/.test(n) || /\bentrega\s+rápida\b/.test(n)) return true;
  if (/\bretire\s+na\s+loja\b/.test(n)) return true;
  if (/\bclick\s+e\s+retire\b/.test(n)) return true;
  /* Após normalizar, traços viram espaço: "... vila madalena r$ 15 90" sem nome de produto. */
  if (/\br\$\s*[\d.,\s]+\s*$/.test(n)) {
    const head = n.replace(/\br\$\s*[\d.,\s]+\s*$/, '').trim();
    const looksLikeStoreBanner =
      (/\bsupermarket\b/.test(head) && /\bmambo\b/.test(head)) ||
      /\bvila madalena\b/.test(head) ||
      (/\bmambo\b/.test(head) && /\b(deputado|lacerda|franco|morumbi|brooklin|higienopolis|higienópolis|leopoldina)\b/.test(head));
    if (head.length >= 18 && looksLikeStoreBanner) return true;
  }
  /* Divulgação genérica sem SKU (ex.: "Mambo — Divulgação #3"). */
  if (/\bdivulgacao\b/.test(n) && !/\b(kg|g|l|ml|un|pct|pack)\b/.test(n)) return true;
  return false;
}

export function promoStoreNamesLooselyAlign(storeName, pointStoreName) {
  const a = normalizeMapChainText(storeName);
  const b = normalizeMapChainText(pointStoreName);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length >= 6 && longer.includes(shorter)) return true;
  return false;
}

/**
 * Logotipos de redes no mapa (Clearbit Logo API — sem chave).
 * No browser a Clearbit costuma falhar (bloqueio/referrer); o mapa usa `/api/map/store-brand-icon`.
 *
 * @see https://logo.clearbit.com/{dominio}
 */

/** @type {Record<string, string>} chave normalizada → URL do logo */
export const STORE_LOGOS = {
  // Supermercados — Brasil (domínios para favicon; ordem de chaves longas → curtas no matching)
  assai: 'https://logo.clearbit.com/assai.com.br',
  'assaí atacadista': 'https://logo.clearbit.com/assai.com.br',
  carrefour: 'https://logo.clearbit.com/carrefour.com.br',
  hypercarrefour: 'https://logo.clearbit.com/carrefour.com.br',
  dia: 'https://logo.clearbit.com/dia.com.br',
  'supermercado dia': 'https://logo.clearbit.com/dia.com.br',
  padraosuper: 'https://logo.clearbit.com/padraosuper.com.br',
  'supermercado padrao': 'https://logo.clearbit.com/padraosuper.com.br',
  'supermercado padrão': 'https://logo.clearbit.com/padraosuper.com.br',
  'mercado padrao': 'https://logo.clearbit.com/padraosuper.com.br',
  'mercado padrão': 'https://logo.clearbit.com/padraosuper.com.br',
  extra: 'https://logo.clearbit.com/carrefour.com.br',
  'pao de acucar': 'https://logo.clearbit.com/gpabr.com',
  'pão de açúcar': 'https://logo.clearbit.com/gpabr.com',
  'pao de acúcar': 'https://logo.clearbit.com/gpabr.com',
  'minuto pao de acucar': 'https://logo.clearbit.com/gpabr.com',
  'minuto pão de açúcar': 'https://logo.clearbit.com/gpabr.com',
  'mercado minuto': 'https://logo.clearbit.com/gpabr.com',
  'minuto mercado': 'https://logo.clearbit.com/gpabr.com',
  'club extra': 'https://logo.clearbit.com/carrefour.com.br',
  mambo: 'https://logo.clearbit.com/mambo.com.br',
  sonda: 'https://logo.clearbit.com/sonda.com.br',
  'supermercados sonda': 'https://logo.clearbit.com/sonda.com.br',
  'rede sonda': 'https://logo.clearbit.com/sonda.com.br',
  lopes: 'https://logo.clearbit.com/supermercadolopes.com.br',
  'supermercado lopes': 'https://logo.clearbit.com/supermercadolopes.com.br',
  hirota: 'https://logo.clearbit.com/hirota.com.br',
  'oba hortifruti': 'https://logo.clearbit.com/obahortifruti.com.br',
  oba: 'https://logo.clearbit.com/obahortifruti.com.br',
  pomar: 'https://logo.clearbit.com/pomar.com.br',
  big: 'https://logo.clearbit.com/big.com.br',
  'supermercado big': 'https://logo.clearbit.com/big.com.br',
  walmart: 'https://logo.clearbit.com/walmart.com.br',
  'sams club': 'https://logo.clearbit.com/samsclub.com',
  "sam's club": 'https://logo.clearbit.com/samsclub.com',
  makro: 'https://logo.clearbit.com/makro.com.br',
  'natural da terra': 'https://logo.clearbit.com/naturaldavila.com.br',
  'sao jorge': 'https://logo.clearbit.com/gruposaojorge.com.br',
  'são jorge': 'https://logo.clearbit.com/gruposaojorge.com.br',
  'sacolao sao jorge': 'https://logo.clearbit.com/gruposaojorge.com.br',
  'sacolão são jorge': 'https://logo.clearbit.com/gruposaojorge.com.br',
  agape: 'https://logo.clearbit.com/agapesupermercados.com.br',
  'armazem do campo': 'https://logo.clearbit.com/armazemdocampo.com.br',
  bentonitelli: 'https://logo.clearbit.com/bentonitelli.com.br',
  guanabara: 'https://logo.clearbit.com/guanabara.com.br',
  prezunic: 'https://logo.clearbit.com/prezunic.com.br',
  'zona sul': 'https://logo.clearbit.com/zonasul.com.br',
  zonasul: 'https://logo.clearbit.com/zonasul.com.br',
  bretas: 'https://logo.clearbit.com/bretas.com.br',
  savegnago: 'https://logo.clearbit.com/savegnago.com.br',
  angeloni: 'https://logo.clearbit.com/angeloni.com.br',
  muffato: 'https://logo.clearbit.com/muffato.com.br',
  'super muffato': 'https://logo.clearbit.com/muffato.com.br',
  verdemar: 'https://logo.clearbit.com/verdemar.com.br',
  'mart minas': 'https://logo.clearbit.com/martminas.com.br',
  martminas: 'https://logo.clearbit.com/martminas.com.br',
  'irmaos goncalves': 'https://logo.clearbit.com/supermercadosgoncalves.com.br',
  'irmãos gonçalves': 'https://logo.clearbit.com/supermercadosgoncalves.com.br',
  barbosa: 'https://logo.clearbit.com/gbarbosa.com.br',
  'super barbosa': 'https://logo.clearbit.com/gbarbosa.com.br',
  gbarbosa: 'https://logo.clearbit.com/gbarbosa.com.br',
  koch: 'https://logo.clearbit.com/koch.com.br',
  'supermercados koch': 'https://logo.clearbit.com/koch.com.br',
  hippo: 'https://logo.clearbit.com/hippo.com.br',
  tonin: 'https://logo.clearbit.com/toninssupermercados.com.br',
  "tonin's": 'https://logo.clearbit.com/toninssupermercados.com.br',
  comper: 'https://logo.clearbit.com/comper.com.br',
  roldao: 'https://logo.clearbit.com/roldao.com.br',
  'roldão': 'https://logo.clearbit.com/roldao.com.br',
  'fort atacadista': 'https://logo.clearbit.com/fort.com.br',
  perini: 'https://logo.clearbit.com/perini.com.br',
  tauste: 'https://logo.clearbit.com/tauste.com.br',
  economart: 'https://logo.clearbit.com/economart.com.br',
  treichel: 'https://logo.clearbit.com/treichel.com.br',
  mateus: 'https://logo.clearbit.com/mateus.com.br',
  nordestao: 'https://logo.clearbit.com/nordestao.com.br',
  'nordestão': 'https://logo.clearbit.com/nordestao.com.br',
  bompreco: 'https://logo.clearbit.com/bompreco.com.br',
  'bom preco': 'https://logo.clearbit.com/bompreco.com.br',
  'bom preço': 'https://logo.clearbit.com/bompreco.com.br',
  maxxi: 'https://logo.clearbit.com/maxxi.com.br',
  'maxxi atacado': 'https://logo.clearbit.com/maxxi.com.br',
  'supermercado epa': 'https://logo.clearbit.com/epasupermercados.com.br',
  epa: 'https://logo.clearbit.com/epasupermercados.com.br',
  spani: 'https://logo.clearbit.com/spani.com.br',
  'supermercado spani': 'https://logo.clearbit.com/spani.com.br',
  'casa forte': 'https://logo.clearbit.com/casaforte.com.br',
  casaforte: 'https://logo.clearbit.com/casaforte.com.br',
  'supermercado bernardo': 'https://logo.clearbit.com/supermercadobernardo.com.br',
  'dalben': 'https://logo.clearbit.com/dalben.com.br',
  'supermercado dalben': 'https://logo.clearbit.com/dalben.com.br',
  'rede economia': 'https://logo.clearbit.com/redeeconomia.com.br',
  'supermercado confiança': 'https://logo.clearbit.com/supermercadoconfianca.com.br',
  confianca: 'https://logo.clearbit.com/supermercadoconfianca.com.br',
  // Farmácias / varejo (ainda aparecem se listadas)
  'droga raia': 'https://logo.clearbit.com/drogaraia.com.br',
  drogaraia: 'https://logo.clearbit.com/drogaraia.com.br',
  drogasil: 'https://logo.clearbit.com/drogasil.com.br',
  ultrafarma: 'https://logo.clearbit.com/ultrafarma.com.br',
  pacheco: 'https://logo.clearbit.com/drogariaspacheco.com.br',
  // Outros pontos comuns no mapa
  kalunga: 'https://logo.clearbit.com/kalunga.com.br',
};

/** Hostnames permitidos no proxy `/api/map/store-brand-icon` (derivados de STORE_LOGOS). */
export const STORE_LOGO_HOSTNAMES = (() => {
  const s = new Set();
  for (const u of Object.values(STORE_LOGOS)) {
    try {
      const path = new URL(u).pathname.replace(/^\//, '');
      const h = path.split('/')[0];
      if (h) s.add(h.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  return s;
})();

/**
 * Remove acentos e normaliza para comparação.
 * @param {string} s
 */
export function normalizeStoreNameKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

/** Normaliza para matching: minúsculas sem acento + pontuação virando espaço (ex.: "Carrefour — SP"). */
export function normalizeStoreNameForLogoMatch(s) {
  return normalizeStoreNameKey(s)
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chaves com menos de 5 caracteres só contam como palavra inteira (evita "dia" em falsos positivos).
 * @param {string} lower resultado de normalizeStoreNameForLogoMatch
 * @param {string} k chave já normalizada
 */
function nameMatchesKey(lower, k) {
  if (!k) return false;
  if (lower === k) return true;
  if (k.length >= 5) return lower.includes(k);
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(lower);
}

/** Arquivos em /public/map-logos — prioridade sobre favicon da API. */
const STORE_LOGO_CUSTOM_PATHS = {
  'pomar da vila madalena': '/map-logos/pomar-da-vila-madalena.png',
  'pomar da vila': '/map-logos/pomar-da-vila-madalena.png',
  'pomar vila madalena': '/map-logos/pomar-da-vila-madalena.png',
  'sacolão são jorge': '/map-logos/sacolao-sao-jorge.png',
  'sacolao sao jorge': '/map-logos/sacolao-sao-jorge.png',
};

function matchCustomStoreLogoPath(storeName) {
  const lower = normalizeStoreNameForLogoMatch(storeName);
  if (!lower) return null;
  const entries = Object.entries(STORE_LOGO_CUSTOM_PATHS).sort((a, b) => b[0].length - a[0].length);
  for (const [key, path] of entries) {
    const k = normalizeStoreNameForLogoMatch(key);
    if (k && nameMatchesKey(lower, k)) return path;
  }
  return null;
}

/** Pomar da Vila (logo em /public/map-logos): pin de loja sempre visível no mapa, mesmo sem oferta. */
export function isPomarDaVilaCuratedStoreName(storeName) {
  return matchCustomStoreLogoPath(storeName) === '/map-logos/pomar-da-vila-madalena.png';
}

/** Sacolão São Jorge (curadoria / map-logos): mesmo critério que Pomar. */
export function isSacolaoSaoJorgeCuratedStoreName(storeName) {
  return matchCustomStoreLogoPath(storeName) === '/map-logos/sacolao-sao-jorge.png';
}

/**
 * Resolve URL do logo pela marca no nome da loja (substring, chaves mais longas primeiro).
 * @param {string} storeName
 * @returns {string | null}
 */
export function getStoreLogo(storeName) {
  if (!storeName || typeof storeName !== 'string') return null;
  const lower = normalizeStoreNameForLogoMatch(storeName);
  if (!lower) return null;

  const entries = Object.entries(STORE_LOGOS).sort((a, b) => b[0].length - a[0].length);
  const keyNorm = (key) => normalizeStoreNameForLogoMatch(key);

  const diaLogoUrl = STORE_LOGOS.dia;
  for (const [key, url] of entries) {
    const k = keyNorm(key);
    if (!k) continue;
    if (nameMatchesKey(lower, k)) {
      if (url === diaLogoUrl && nameMatchesKey(lower, 'hirota')) continue;
      return url;
    }
  }

  const firstWord = lower.split(/\s+/)[0] || '';
  if (firstWord.length >= 4) {
    for (const [key, url] of entries) {
      const k = keyNorm(key);
      if (k.length >= 4 && k.startsWith(firstWord)) {
        if (url === diaLogoUrl && nameMatchesKey(lower, 'hirota')) continue;
        return url;
      }
    }
  }

  return null;
}

/**
 * URL same-origin para o pin no mapa (fetch no servidor → imagem confiável no cliente).
 * @param {string} storeName
 * @returns {string | null}
 */
export function getStoreLogoPinSrc(storeName) {
  const custom = matchCustomStoreLogoPath(storeName);
  if (custom) return custom;

  const clearbitUrl = getStoreLogo(storeName);
  if (!clearbitUrl) return null;
  try {
    const pathname = new URL(clearbitUrl).pathname.replace(/^\//, '');
    const host = pathname.split('/')[0].toLowerCase();
    if (!host || !STORE_LOGO_HOSTNAMES.has(host)) return null;
    return `/api/map/store-brand-icon?d=${encodeURIComponent(host)}`;
  } catch {
    return null;
  }
}

/**
 * Quando todos os pontos do grupo são da mesma rede (mesmo `getStoreLogoPinSrc`), usa logo no círculo de ofertas.
 * @param {{ points: Array<{ nome?: string, store_name?: string }> }} group
 * @returns {string | null}
 */
export function getHomogeneousGroupLogoPinSrc(group) {
  const pts = group?.points;
  if (!Array.isArray(pts) || pts.length === 0) return null;
  let only = null;
  for (const p of pts) {
    const name = String(p.nome ?? p.store_name ?? '').trim();
    if (!name) return null;
    const src = getStoreLogoPinSrc(name);
    if (!src) return null;
    if (only === null) only = src;
    else if (only !== src) return null;
  }
  return only;
}

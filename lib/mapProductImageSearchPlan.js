/**
 * Plano de busca de miniaturas no mapa: contexto (fast food vs supermercado),
 * chaves extra no cache (categorias / sinónimos) e queries Google mais específicas
 * que só o nome do produto (evita suplementos em "shake", etc.).
 *
 * Regras de keyword → categoria: preferir tabela `map_thumbnail_match_rules` (painel).
 * Fallback em código: MAP_THUMBNAIL_STATIC_RULES=0 desliga o embutido.
 */

import { collectCanonicalsFromDbRules, getThumbnailMatchRulesCached } from './mapThumbnailMatchRules';
import { normalizeMapChainText } from './mapStoreChainMatch';

/** Alinhado a lib/mapProductImageCache.js — manter coerente ao alterar. */
export function normProductImageKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

const FAST_FOOD_HINTS =
  /\b(burger\s*king|\bbk\b|mcdonald|mcdonald'?s|\bmc\b|subway|kfc|habib|habibs|giraffas|outback|bob'?s|pizza\s*hut|domino|popeyes|jeronymo|spoleto)\b/i;

const SUPERMARKET_HINTS =
  /\b(supermercado|hipermercado|atacad[aã]o|atacado|mercado|carrefour|assai|assaí|extra\b|dia\b|mambo|hirota|pomar|sacol[aã]o|p[aã]o\s*de\s*a[cç][uú]car|padrao|lopes|sonda|agape|hortifruti|minimercado|mercadinho)\b/i;

/**
 * @returns {'fast_food' | 'supermarket' | 'generic'}
 */
export function inferRetailContext(storeName) {
  const n = normalizeMapChainText(storeName);
  if (!n) return 'generic';
  const ff = FAST_FOOD_HINTS.test(storeName) || FAST_FOOD_HINTS.test(n);
  const sm = SUPERMARKET_HINTS.test(storeName) || SUPERMARKET_HINTS.test(n);
  if (ff && !sm) return 'fast_food';
  if (sm && !ff) return 'supermarket';
  if (ff && sm) return 'fast_food';
  return 'generic';
}

/**
 * Palavra-chave no nome do produto → rótulo para gravar no repositório de miniaturas
 * (ex.: repositório "Arroz" cobre "Arroz Tio João 5kg").
 *
 * Ordem importa: regras mais específicas primeiro (pão de forma antes de "pão";
 * carne de porco antes de "carne").
 */
/** Em fast food, estas chaves extra permitem um único URL no repositório (ex. "Milk shake") para vários nomes de cardápio. */
const FAST_FOOD_IMAGE_ALIAS_RULES = [
  {
    re: /\bbk\s*mix\b|\bshake\b|\bmilkshake\b|\bmilk\s*shake\b|\bthick\s*shake\b|\bfloat\b|\bmcflurry\b/i,
    canonical: 'Milk shake',
  },
  { re: /\bsundae\b|\bcasquinha\b/i, canonical: 'Sundae' },
  { re: /\bbalde\s*(de\s*)?batata\b|\bchicken\s*fries\b|\bnuggets?\b|\bbatata\s*frita\b/i, canonical: 'Batata frita' },
  { re: /\bhamb[uú]rguer\b|\bwhopper\b|\bstacker\b|\bbig\s*king\b/i, canonical: 'Hambúrguer' },
  { re: /\brefri\b|\brefrigerante\b/i, canonical: 'Refrigerante' },
];

const SUPERMARKET_CATEGORY_RULES = [
  /* —— Padaria —— */
  { re: /\bp[aã]o\s*de\s*forma\b|\bp[aã]o\s*forma\b/i, canonical: 'Pão de forma' },
  { re: /\bbolo\b|\btorta\b|\bpudim\b|\bpanetone\b|\bpanettone\b|\brocambole\b/i, canonical: 'Bolos e tortas' },
  {
    re: /\bp[aã]o\b|\bbisnaga\b|\bbr[ií]oche\b|\bbaguette\b|\bsonho\b|\bcroissant\b|\bp[aã]o\s*franc[eê]s\b/i,
    canonical: 'Pão',
  },

  /* —— Talho e peixaria —— */
  {
    re: /\bcarne\s*de\s*porco\b|\bporco\b|\bsu[ií]no\b|\blombo\s*su[ií]no\b|\bpernil\s*su[ií]no\b|\bpanceta\b|\btoucinho\b|\bchuleta\s*de\s*porco\b/i,
    canonical: 'Carne de porco',
  },
  {
    re: /\bfrango\b|\bpeito\s*de\s*frango\b|\bsobrecoxa\b|\bcoxa\b(?=.*\bfrango\b)|\bsobrep[eé]ito\b|\bsassami\b|\bgalinha\b|\basa\s*de\s*frango\b|\bfile\s*de\s*frango\b|\bfrango\s*a\s*passarinho\b/i,
    canonical: 'Frango',
  },
  {
    re: /\bpeixe\b|\btil[aá]pia\b|\bsalm[aã]o\b|\bsardinha\b|\bcamar[aã]o\b|\bfile\s*de\s*peixe\b|\bpescado\b|\bmerluza\b|\bpolvo\b|\blula\b|\bcaranguejo\b/i,
    canonical: 'Peixe fresco',
  },
  { re: /\bovos?\b|\bcartela\s*de\s*ovos\b|\bovo\s*c[aá]rdio\b/i, canonical: 'Ovos' },
  {
    re: /\bbovin|\bbife\b|\balcatra\b|\bpicanha\b|\bmaminha\b|\bfraldinha\b|\bcontrafil[eé]\b|\bpatinho\b|\blagarto\b|\bcupim\b|\bancho\b|\bcostela\b(?!\s*de\s*porco)|\bchurrasco\b(?!\s*de\s*frango)|\bcarne\s*mo[ií]da\b(?!\s*de\s*frango|\s*su[ií]na)|\bm[ií]do\b(?=.*\bbovin)|\biscas?\s*de\s*carne\b/i,
    canonical: 'Carne bovina',
  },
  { re: /\bcarne\b|\bchurrasco\b/i, canonical: 'Carne bovina' },

  /* —— Hortifrúti —— */
  { re: /\btomate\b|\btomatinho\b|\btomate\s*italiano\b/i, canonical: 'Tomate' },
  {
    re: /\balface\b|\bcouve\b|\br[uú]cula\b|\bespinafre\b|\brepolho\b|\bcoentro\b|\bcebolinha\b|\bsalsinha\b|\bhortel[aã]\b/i,
    canonical: 'Verduras',
  },
  {
    re: /\bcenoura\b|\bbatata\b(?!\s*frita)(?!\s*palha)|\bcebola\b(?!\s*cebolinha)|\bbeterraba\b|\bnabo\b|\bchuchu\b|\babobrinha\b|\bmandioquinha\b|\binhame\b|\bmilho\b(?!\s*verde)|\bquiabo\b|\bvagem\b/i,
    canonical: 'Legumes',
  },
  {
    re: /\bfrutas?\b|\bcesta\s*de\s*frutas\b|\bbanana\b|\bma[cç][aã]\b|\blaranja\b|\buva\b|\bmel[aã]o\b|\bmam[aã]o\b|\bpera\b|\bp[eê]ssego\b|\bmorango\b|\babacate\b|\bgoiaba\b|\bkiwi\b|\bmaracuj[aá]\b|\btangerina\b|\bbergamota\b|\bfigo\b|\bameixa\b/i,
    canonical: 'Frutas',
  },

  /* —— Laticínios e frios —— */
  { re: /\bleite\b|\buht\b|\bsemidesnatado\b|\bdesnatado\b|\bleite\s*condensado\b|\bcreme\s*de\s*leite\b/i, canonical: 'Leite' },
  {
    re: /\bqueijo\b|\bmussarela\b|\bmu[cç]arela\b|\bprato\b(?=.*\bqueijo\b)|\bminas\b(?=.*\bqueijo\b)|\bcheddar\b|\bgorgonzola\b|\brequeij[aã]o\b|\bcream\s*cheese\b/i,
    canonical: 'Queijo',
  },
  {
    re: /\bpresunto\b|\bmortadela\b|\bsalame\b|\blinguic|\bpeito\s*de\s*peru\b|\bblanquet\s*de\s*peru\b|\bsalaminho\b|\bapresuntado\b/i,
    canonical: 'Presunto e enchidos',
  },
  { re: /\biogurte\b|\bdanone\b|\bgrego\b(?=.*\biogurte\b)|\bactivia\b|\bneston\b(?=.*\biogurte\b)/i, canonical: 'Iogurte' },
  { re: /\bmanteiga\b|\bmargarina\b/i, canonical: 'Manteiga e margarina' },

  /* —— Mercearia —— */
  { re: /\barroz\b|\bparboiliz|\bintegral\b(?=.*\barroz\b)/i, canonical: 'Arroz' },
  { re: /\bfeij[aã]o\b|\blentilha\b|\bgr[aã]o\s*de\s*bico\b|\bervilha\b(?=.*\bseca\b)|\bsoja\b(?=.*\bgr[aã]o\b)/i, canonical: 'Feijão' },
  {
    re: /\bmacarr[aã]o\b|\bmassa\b(?=.*\bnhoque\b)|\bnhoque\b|\bespaguete\b|\bparafuso\b|\bpenne\b|\blasanha\b|\bcanelone\b/i,
    canonical: 'Macarrão e massa',
  },
  { re: /\b[oó]leo\b(?!\s*essencial)|\bazeite\b|\b[oó]leo\s*de\s*soja\b|\b[oó]leo\s*de\s*canola\b|\b[oó]leo\s*de\s*milho\b/i, canonical: 'Óleo de cozinha' },
  { re: /\ba[cç][uú]car\b|\bado[cç]ante\b|\bst[eé]via\b|\bxilitol\b/i, canonical: 'Açúcar e adoçante' },
  { re: /\bcaf[eé]\s*(?:em\s*)?p[oó]\b|\bcaf[eé]\b(?!\s*(?:com\s*leite|latte|capsula|c[aá]psula))/i, canonical: 'Café em pó' },
  { re: /\bbolach|\bbiscoito\b|\bcookie\b|\bwafer\b|\bsnack\b(?=.*\bsalgad)/i, canonical: 'Bolacha e biscoito' },
  { re: /\bcereal\b|\bgranola\b|\baveia\b|\bmuesli\b/i, canonical: 'Cereais e granola' },

  /* —— Limpeza —— */
  { re: /\bdetergente\b|\blava\s*lou[cç]a\b|\blou[cç]a\b(?=.*\bdetergente\b)/i, canonical: 'Detergente' },
  {
    re: /\bsab[aã]o\s*em\s*p[oó]\b|\bamaciante\b|\blava\s*roupas\b|\bsab[aã]o\s*em\s*pedra\b(?=.*\broupa\b)|\btira\s*manchas\b|\balvejante\b/i,
    canonical: 'Sabão em pó e amaciante',
  },
  { re: /\bpapel\s*higi[eê]nic|\bpapel\s*higienico\b|\bfolha\s*dupla\b(?=.*\bpapel\b)/i, canonical: 'Papel higiênico' },
  {
    re: /\bdesinfetante\b|\b[aá]gua\s*sanit[aá]ria\b|\blisoform\b|\bmultiuso\b(?=.*\blimp)|\bveja\b|\bajax\b|\bpinho\s*sol\b/i,
    canonical: 'Limpeza',
  },

  /* —— Higiene pessoal —— */
  {
    re: /\bshampoo\b|\bchamp[oô]\b|\bcondicionador\b|\b2\s*em\s*1\b(?=.*\bcabelo\b)|\bcreamy\b(?=.*\bcabelo\b)/i,
    canonical: 'Champô e condicionador',
  },
  { re: /\bsabonete\b|\bbody\s*wash\b|\bgel\s*de\s*banho\b/i, canonical: 'Sabonete' },
  { re: /\bpasta\s*de\s*dente\b|\bcreme\s*dental\b|\bescova\b(?=.*\bdente\b)/i, canonical: 'Pasta de dentes' },

  /* —— Bebidas (supermercado) —— */
  {
    re: /\brefrigerante\b|\bcoca\b|\bfanta\b|\bguaran[aá]\b|\bsuco\b|\bn[eé]ctar\b|\b[né]ctar\b|\b[isí]is\b|\bsoda\b/i,
    canonical: 'Refrigerante',
  },
  { re: /\bcerveja\b|\bchopp\b|\blong\s*neck\b|\bpilsen\b|\bipa\b|\bstout\b/i, canonical: 'Cerveja' },
  { re: /\b[aá]gua\s*mineral\b|\b[aá]gua\s*sem\s*g[aá]s\b|\b[aá]gua\s*com\s*g[aá]s\b/i, canonical: 'Água mineral' },
  { re: /\benerg[eé]tico\b|\bmonster\b|\bred\s*bull\b/i, canonical: 'Energético' },
];

/** Quando o pin não traz nome de supermercado, ainda tenta categorias se o produto “parece” gôndola. */
const SUPERMARKET_PRODUCT_FALLBACK_HINT =
  /\b(arroz|feij[aã]o|leite|iogurte|queijo|presunto|mortadela|detergente|amaciante|sab[aã]o\s*em\s*p[oó]|picanha|frango|macarr[aã]o|caf[eé]|a[cç][uú]car|bolach|biscoito|papel\s*higi)/i;

function collectSupermarketCanonicalsStatic(productRaw) {
  const out = [];
  for (const { re, canonical } of SUPERMARKET_CATEGORY_RULES) {
    if (re.test(productRaw)) out.push(canonical);
  }
  return out;
}

/** Rótulos sugeridos para o repositório de miniaturas (supermercado), sem duplicados. */
export function listSupermarketImageCanonicalLabels() {
  const seen = new Set();
  const out = [];
  for (const { canonical } of SUPERMARKET_CATEGORY_RULES) {
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

function collectFastFoodCanonicals(productRaw) {
  const out = [];
  for (const { re, canonical } of FAST_FOOD_IMAGE_ALIAS_RULES) {
    if (re.test(productRaw)) out.push(canonical);
  }
  return out;
}

function normalizeForMatch(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function shouldSkipOpenFoodFacts(ctx, productRaw, productNorm) {
  const ffProduct =
    ctx === 'fast_food' || /\b(bk|whopper|mcdonald|mcflurry|big\s*mac)\b/i.test(productRaw);
  if (!ffProduct) return false;
  const p = productRaw;
  const n = productNorm;
  if (/\b(bk|whopper|big\s*king|stacker|mcnugget|mcflurry|quarter|subway|kfc)\b/i.test(p)) return true;
  if (
    /\b(shake|milkshake|milk\s*shake|sundae|casquinha|mcflurry|float|sorvete|gelado|bk\s*mix|mix\s*bk)\b/i.test(
      n
    )
  ) {
    return true;
  }
  if (/\b(balde|batata|nugget|combo)\b/i.test(n) && /\b(bk|burger|king|mcdonald|mcd)\b/i.test(p)) return true;
  return false;
}

function uniqStrings(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const t = String(x || '').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Queries para Google CSE (imagem), da mais específica à genérica.
 */
function buildGoogleQueries(ctx, storeLabel, productLabel) {
  const store = String(storeLabel || '').trim();
  const prod = String(productLabel || '').trim();
  const qs = [];

  const strip = (s) =>
    String(s || '')
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const s = strip(store);
  const p = strip(prod);

  if (ctx === 'fast_food') {
    if (s && p) {
      qs.push(`${s} ${p} milk shake sorvete menu Brasil`);
      qs.push(`${s} ${p} fast food lanche Brasil`);
      qs.push(`${s} ${p} restaurante cardápio`);
    }
    if (p) {
      qs.push(`${p} milk shake fast food Brasil`);
      qs.push(`${p} sorvete lanchonete`);
    }
  } else if (/\b(bk|whopper|mcdonald|mcflurry)\b/i.test(p)) {
    if (s && p) {
      qs.push(`${s} ${p} fast food menu Brasil`);
      qs.push(`${s} ${p} milk shake sorvete`);
    }
    qs.push(`${p} fast food lanche Brasil`);
  } else if (ctx === 'supermarket') {
    if (s && p) {
      qs.push(`${s} ${p} supermercado embalagem produto`);
      qs.push(`${p} supermercado pacote Brasil`);
    }
    if (p) {
      qs.push(`${p} mercado embalagem alimento`);
    }
  }

  if (s && p) {
    qs.push(`${s} ${p} comida produto Brasil`);
  }
  qs.push(`${p} ${s} alimento`.trim());
  return uniqStrings(qs).filter((q) => q.length >= 3);
}

/**
 * @param {string} productRaw
 * @param {'fast_food' | 'supermarket' | 'generic'} ctx
 */
export function inferSupermarketProductHint(productRaw, ctx) {
  const product = String(productRaw || '').trim();
  return (
    ctx === 'supermarket' || (ctx === 'generic' && SUPERMARKET_PRODUCT_FALLBACK_HINT.test(product))
  );
}

/**
 * @param {string} productName — já sem sufixo fan-out (usar productNameForThumbnailSearch)
 * @param {string} storeName
 */
export async function buildThumbnailImagePlanAsync(productName, storeName) {
  const product = String(productName || '').trim();
  const store = String(storeName || '').trim();
  const productNorm = normalizeForMatch(product);
  const ctx = inferRetailContext(store);
  const supermarketProductHint = inferSupermarketProductHint(product, ctx);
  const googleCtx = supermarketProductHint && ctx === 'generic' ? 'supermarket' : ctx;

  let dbRules = [];
  try {
    dbRules = await getThumbnailMatchRulesCached();
  } catch (e) {
    console.warn('buildThumbnailImagePlanAsync: rules cache', e?.message || e);
  }
  const fromDb = collectCanonicalsFromDbRules(product, ctx, supermarketProductHint, dbRules);

  const useStatic =
    typeof process !== 'undefined' && process.env?.MAP_THUMBNAIL_STATIC_RULES !== '0';
  const staticLabels = [];
  if (useStatic) {
    if (supermarketProductHint) {
      staticLabels.push(...collectSupermarketCanonicalsStatic(product));
    }
    if (ctx === 'fast_food' || /\b(bk|whopper|mcdonald|mcflurry|big\s*mac)\b/i.test(product)) {
      staticLabels.push(...collectFastFoodCanonicals(product));
    }
  }

  const categoryLabels = uniqStrings([...fromDb, ...staticLabels]);
  const cacheKeys = [normProductImageKey(product)];
  for (const c of categoryLabels) {
    cacheKeys.push(normProductImageKey(c));
  }

  const skipOpenFoodFacts = shouldSkipOpenFoodFacts(ctx, product, productNorm);
  const openFoodFactsQuery = skipOpenFoodFacts ? null : product;

  const googleQueries = buildGoogleQueries(googleCtx, store, product);

  return {
    retailContext: ctx,
    cacheLookupKeys: uniqStrings(cacheKeys),
    skipOpenFoodFacts,
    openFoodFactsQuery,
    googleQueries,
  };
}

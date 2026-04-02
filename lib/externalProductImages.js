/** Open Food Facts exige User-Agent identificável: https://openfoodfacts.github.io/openfoodfacts-server/api/ */
const OFF_USER_AGENT = 'FinMemory/1.0 (https://finmemory.com.br; mapa preços)';

function isLikelyImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim().toLowerCase();
  if (!/^https?:\/\//.test(u)) return false;
  if (/\.(jpg|jpeg|png|webp|gif|avif|svg)(\?|#|$|&)/i.test(u)) return true;
  if (/images\.openfoodfacts\.org|googleusercontent|gstatic|cdn|cloudfront|imgix|cloudinary/i.test(u)) {
    return true;
  }
  return false;
}

function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchTerms(name, storeName) {
  const base = normalizeText(name).split(' ').slice(0, 10).join(' ');
  const store = normalizeText(storeName).split(' ').slice(0, 4).join(' ');
  return `${base} ${store} produto`;
}

function pickOffImageFromProduct(p) {
  return (
    p?.image_front_small_url ||
    p?.image_front_url ||
    p?.image_url ||
    null
  );
}

function scoreNameMatch(productName, wantedNorm) {
  const pn = normalizeText(productName).toLowerCase();
  if (!pn || !wantedNorm) return 0;
  const wa = wantedNorm.split(/\s+/).filter((w) => w.length > 2);
  let score = 0;
  for (const w of wa) {
    if (pn.includes(w)) score += 1;
  }
  return score;
}

async function fetchOpenFoodFactsSearchOnce(searchTerms) {
  const terms = normalizeText(searchTerms);
  if (!terms || terms.length < 2) return [];

  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', terms);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '12');
  url.searchParams.set(
    'fields',
    'product_name,brands,image_front_url,image_url,image_front_small_url'
  );

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': OFF_USER_AGENT,
    },
  });
  if (!res.ok) return [];
  const payload = await res.json();
  return Array.isArray(payload?.products) ? payload.products : [];
}

function bestImageFromProducts(products, wantedNorm) {
  if (!products.length) return null;

  const scored = [];
  for (const p of products) {
    const candidate = pickOffImageFromProduct(p);
    if (!candidate || !isLikelyImageUrl(candidate)) continue;
    const name = String(p?.product_name || '');
    const sc = scoreNameMatch(name, wantedNorm);
    scored.push({ candidate, sc });
  }
  scored.sort((a, b) => b.sc - a.sc);
  if (scored.length && scored[0].sc > 0) return scored[0].candidate;

  for (const p of products) {
    const candidate = pickOffImageFromProduct(p);
    if (candidate && isLikelyImageUrl(candidate)) return candidate;
  }
  return null;
}

/**
 * Busca imagem no Open Food Facts pelo nome do produto (gratuito).
 * Tenta o nome completo, depois os primeiros tokens (marcas tipo Heineken/Coca-Cola).
 */
export async function fetchOpenFoodFactsImageByName(name) {
  const full = normalizeText(name);
  if (!full || full.length < 3) return null;
  const wantedNorm = full.toLowerCase();

  const variants = [full];
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length > 6) variants.push(parts.slice(0, 6).join(' '));
  if (parts.length > 4) variants.push(parts.slice(0, 4).join(' '));
  if (parts.length > 2) variants.push(parts.slice(0, 3).join(' '));

  const tried = new Set();
  for (const v of variants) {
    const key = v.trim().toLowerCase();
    if (tried.has(key) || key.length < 3) continue;
    tried.add(key);
    try {
      const products = await fetchOpenFoodFactsSearchOnce(v);
      const img = bestImageFromProducts(products, wantedNorm);
      if (img) return img;
    } catch {
      /* rede / timeout */
    }
  }
  return null;
}

export async function fetchGoogleCseImageByName(name, storeName) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) return null;

  const q = buildSearchTerms(name, storeName);
  if (!q) return null;

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cseId);
  url.searchParams.set('q', q);
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('safe', 'active');
  url.searchParams.set('num', '5');
  url.searchParams.set('gl', 'br');
  url.searchParams.set('hl', 'pt-BR');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const payload = await res.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];
  for (const it of items) {
    const link = it?.link || null;
    if (link && isLikelyImageUrl(link)) return link;
  }
  return null;
}

export function isValidResolvedImage(url) {
  return isLikelyImageUrl(url);
}

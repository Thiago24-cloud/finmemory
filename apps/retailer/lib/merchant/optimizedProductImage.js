const MIN_IMAGE_WIDTH = 700;
const MIN_IMAGE_HEIGHT = 700;

function sanitizeQuery(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function isHttpsUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildWeservContainUrl(rawUrl) {
  if (!isHttpsUrl(rawUrl)) return null;
  const source = rawUrl.replace(/^https?:\/\//i, '');
  const wsrv = new URL('https://wsrv.nl/');
  wsrv.searchParams.set('url', source);
  wsrv.searchParams.set('w', '900');
  wsrv.searchParams.set('h', '900');
  wsrv.searchParams.set('fit', 'contain');
  wsrv.searchParams.set('bg', 'ffffff');
  wsrv.searchParams.set('q', '92');
  wsrv.searchParams.set('output', 'webp');
  wsrv.searchParams.set('we', '1');
  return wsrv.toString();
}

function candidateFromGoogleItem(item) {
  const link = String(item?.link || '').trim();
  if (!isHttpsUrl(link)) return null;
  const width = Number(item?.image?.width || 0);
  const height = Number(item?.image?.height || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { link, width, height };
}

function byBestResolution(a, b) {
  return b.width * b.height - a.width * a.height;
}

export async function searchHighResolutionImageByProductName(productName) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) return null;

  const queryBase = sanitizeQuery(productName);
  if (!queryBase || queryBase.length < 2) return null;

  const query = `${queryBase} produto embalagem fundo branco`;
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cseId);
  url.searchParams.set('q', query);
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('imgType', 'photo');
  url.searchParams.set('safe', 'active');
  url.searchParams.set('num', '8');
  url.searchParams.set('gl', 'br');
  url.searchParams.set('hl', 'pt-BR');

  const resp = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
  if (!resp.ok) return null;
  const payload = await resp.json().catch(() => ({}));
  const items = Array.isArray(payload?.items) ? payload.items : [];

  const candidates = items
    .map(candidateFromGoogleItem)
    .filter(Boolean)
    .filter((c) => c.width >= MIN_IMAGE_WIDTH && c.height >= MIN_IMAGE_HEIGHT)
    .sort(byBestResolution);

  return candidates[0]?.link || null;
}

export async function resolveOptimizedProductImage({
  productName,
  imageUrl,
  allowSearchByName = true,
}) {
  const fromInput = isHttpsUrl(imageUrl) ? String(imageUrl).trim() : null;
  let sourceUrl = fromInput;

  if (!sourceUrl && allowSearchByName) {
    sourceUrl = await searchHighResolutionImageByProductName(productName);
  }

  if (!sourceUrl) {
    return {
      sourceUrl: null,
      optimizedUrl: null,
      optimized: false,
    };
  }

  return {
    sourceUrl,
    optimizedUrl: buildWeservContainUrl(sourceUrl),
    optimized: true,
  };
}

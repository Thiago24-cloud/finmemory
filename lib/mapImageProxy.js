/**
 * Proxy de imagens de produto no mapa — allowlist compartilhada (API + cliente).
 * Evita SSRF: só hosts de varejo/CDNs usados pelos scrapers.
 */

/** Sufixos de hostname permitidos (ex.: foo.dia.com.br e dia.com.br). */
export const IMAGE_PROXY_HOST_SUFFIXES = [
  'dia.com.br',
  'padraosuper.com.br',
  'assai.com.br',
  'carrefour.com.br',
  'paodeacucar.com.br',
  'gpa.digital',
  'sonda.com.br',
  'sondadelivery.com.br',
  'mambo.com.br',
  'supermercadolopes.com.br',
  'mercadolivre.com.br',
  'mlstatic.com',
  'kimbino.com.br',
  'blackskull.com.br',
  'maxtitanium.com.br',
  '3vs.com.br',
  'danone.com.br',
  'nestle.com.br',
  'heinz.com',
  'italac.com.br',
  'quero.com.br',
  'sadia.com.br',
  'perdigao.com.br',
  'copacol.com.br',
  'wessel.com.br',
  'noronha.com.br',
  'prieto.com.br',
  'cocinero.com.br',
  'borges.com.br',
  'lacta.com.br',
  'milka.com',
  'mondelezinternational.com',
  'waferello.com',
  'imgix.net',
  'cloudinary.com',
  'akamaized.net',
  'fastly.net',
];

const OFF_HOST = /(^|\.)openfoodfacts\.org$/i;

export function isImageProxyAllowedHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.local')) return false;
  return IMAGE_PROXY_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

/** URLs que o browser pode pedir direto (sem proxy). */
export function shouldSkipProductImageProxy(url) {
  if (!url || typeof url !== 'string') return true;
  const t = url.trim();
  if (!t || t.startsWith('data:') || t.startsWith('/')) return true;
  let u;
  try {
    u = new URL(t);
  } catch {
    return true;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
  const host = u.hostname.toLowerCase();
  if (OFF_HOST.test(host)) return true;
  if (host.endsWith('.supabase.co') && u.pathname.includes('/storage/v1/object/public')) return true;
  return false;
}

/**
 * Se a URL for externa e permitida para proxy, devolve path da API Next.
 * Caso contrário devolve a URL original (ou vazia).
 */
export function getMapProductImageSrcForImg(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  if (!t) return '';
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DISABLE_MAP_IMAGE_PROXY === '1') {
    return t;
  }
  if (shouldSkipProductImageProxy(t)) return t;
  let u;
  try {
    u = new URL(t);
  } catch {
    return t;
  }
  if (!isImageProxyAllowedHost(u.hostname)) return t;
  return `/api/map/product-image?url=${encodeURIComponent(t)}`;
}

import { getMapProductImageSrcForImg } from './mapImageProxy';

export function getMapOptimizedProductCardImageSrc(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const proxied = getMapProductImageSrcForImg(raw) || raw;
  const clean = String(proxied).trim();
  if (!/^https?:\/\//i.test(clean)) return clean;
  const source = clean.replace(/^https?:\/\//i, '');
  const wsrv = new URL('https://wsrv.nl/');
  wsrv.searchParams.set('url', source);
  wsrv.searchParams.set('w', '900');
  wsrv.searchParams.set('h', '900');
  wsrv.searchParams.set('fit', 'contain');
  wsrv.searchParams.set('bg', 'ffffff');
  wsrv.searchParams.set('q', '90');
  wsrv.searchParams.set('output', 'webp');
  wsrv.searchParams.set('we', '1');
  return wsrv.toString();
}

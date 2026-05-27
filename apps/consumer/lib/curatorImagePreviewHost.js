import { isImageProxyAllowedHost } from './mapImageProxy';

/**
 * Hosts que o curador pode pedir via proxy (admin) — Google CSE + mesmos CDNs do mapa.
 * Evita SSRF: só suffixos conhecidos.
 */
export function isCuratorPreviewAllowedHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.local')) return false;
  if (isImageProxyAllowedHost(h)) return true;
  if (h === 'gstatic.com' || h.endsWith('.gstatic.com')) return true;
  if (h === 'googleusercontent.com' || h.endsWith('.googleusercontent.com')) return true;
  if (h === 'ggpht.com' || h.endsWith('.ggpht.com')) return true;
  return false;
}

/**
 * No browser, miniaturas do Google costumam falhar (Referer/hotlink). Usar proxy admin.
 */
export function curatorCandidateImageSrc(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  if (!/^https?:\/\//i.test(t)) return t;
  try {
    const u = new URL(t);
    if (isCuratorPreviewAllowedHost(u.hostname)) {
      return `/api/admin/product-image-curator-preview?url=${encodeURIComponent(t)}`;
    }
  } catch {
    /* ignore */
  }
  return t;
}

import { requireMapQuickAddAdminForApi } from '../../../lib/requireMapQuickAddAdminApi';
import { isCuratorPreviewAllowedHost } from '../../../lib/curatorImagePreviewHost';

const MAX_URL_LEN = 4096;
const FETCH_MS = 12_000;

function firstQueryString(val) {
  if (val == null) return '';
  if (Array.isArray(val)) return typeof val[0] === 'string' ? val[0] : '';
  return typeof val === 'string' ? val : '';
}

/**
 * GET /api/admin/product-image-curator-preview?url=
 * Proxy com auth admin — Google CSE + allowlist do mapa (miniaturas no painel de curadoria).
 *
 * Nota: no Pages Router o Next.js já faz decode do query string uma vez; não usar
 * decodeURIComponent de novo (URLs do Google têm %… e quebram ou geram URIError → 400).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireMapQuickAddAdminForApi(req, res);
  if (!ctx) return;

  const decoded = firstQueryString(req.query.url).trim();
  if (!decoded) {
    return res.status(400).json({ error: 'Parâmetro url ausente' });
  }

  if (decoded.length > MAX_URL_LEN) {
    return res.status(400).json({ error: 'url muito longa' });
  }

  let parsed;
  try {
    parsed = new URL(decoded);
  } catch {
    return res.status(400).json({ error: 'URL mal formada' });
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return res.status(400).end();
  }

  const host = parsed.hostname.toLowerCase();
  if (!isCuratorPreviewAllowedHost(host)) {
    return res.status(403).json({ error: 'domínio não permitido para pré-visualização' });
  }

  const origin = `${parsed.protocol}//${parsed.host}`;

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), FETCH_MS);

  try {
    const upstream = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Referer: `${origin}/`,
      },
    });

    if (!upstream.ok) {
      return res.status(502).end();
    }

    const ct = upstream.headers.get('content-type') || '';
    if (!ct.toLowerCase().startsWith('image/')) {
      return res.status(502).end();
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > 6 * 1024 * 1024) {
      return res.status(502).end();
    }

    res.setHeader('Content-Type', ct.split(';')[0].trim());
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200');
    return res.status(200).send(buf);
  } catch {
    return res.status(502).end();
  } finally {
    clearTimeout(to);
  }
}

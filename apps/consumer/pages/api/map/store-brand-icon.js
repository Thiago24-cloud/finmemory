/**
 * GET /api/map/store-brand-icon?d=dia.com.br
 * Ícone same-origin para pins do mapa. Google s2 favicons é o caminho mais estável (Clearbit falha muito no servidor).
 * Se o proxy falhar, 302 para o favicon no Google — o browser segue e mostra a imagem.
 */

const UA = 'FinMemory/1.0 (map pin)';
const MAX_BYTES = 400_000;

function isSafeLogoDomain(d) {
  const s = String(d || '').trim().toLowerCase();
  if (s.length < 4 || s.length > 120) return false;
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(s)) return false;
  if (!s.includes('.') || s.includes('..')) return false;
  if (s.endsWith('.local') || s.endsWith('.internal')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return false;
  return true;
}

function googleFaviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function looksLikeImage(buf, contentType) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.startsWith('image/')) return true;
  if (buf.length < 4) return false;
  const b0 = buf[0];
  const b1 = buf[1];
  const b2 = buf[2];
  const b3 = buf[3];
  if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47) return true;
  if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) return true;
  if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46) return true;
  if (b0 === 0x00 && b1 === 0x00 && b2 === 0x01 && b3 === 0x00) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const raw = String(req.query.d || '').trim().toLowerCase();
  if (!isSafeLogoDomain(raw)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'Parâmetro d inválido (hostname esperado, ex.: dia.com.br)' });
  }

  const fallback = googleFaviconUrl(raw);
  const timeoutMs = Math.min(15_000, Math.max(3000, Number(process.env.STORE_BRAND_ICON_FETCH_MS || 9000) || 9000));
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    const r = await fetch(fallback, {
      headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow',
      signal,
    });

    if (!r.ok) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.redirect(302, fallback);
    }

    const ab = await r.arrayBuffer();
    if (ab.byteLength < 8 || ab.byteLength > MAX_BYTES) {
      return res.redirect(302, fallback);
    }

    const buf = Buffer.from(ab);
    let contentType = r.headers.get('content-type') || '';
    if (!looksLikeImage(buf, contentType)) {
      return res.redirect(302, fallback);
    }

    const ctOut = contentType.startsWith('image/')
      ? contentType.split(';')[0].trim()
      : 'image/png';
    res.setHeader('Content-Type', ctOut);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.status(200).send(buf);
  } catch (e) {
    console.warn('[store-brand-icon]', raw, e?.message || e);
    res.setHeader('Cache-Control', 'public, max-age=1800');
    return res.redirect(302, fallback);
  }
}

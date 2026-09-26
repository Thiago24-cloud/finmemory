/**
 * Helpers de página pública / QR da loja (B2C).
 */

const SLUG_MAX = 48;

export function slugifyStoreName(name) {
  const base = String(name || 'loja')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX);
  return base || 'loja';
}

export function shortToken(len = 6) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function normalizeWhatsappDigits(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 12 && digits.startsWith('55')) return digits.slice(0, 13);
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.slice(0, 13);
}

export function buildQrImageUrl(data, size = 240) {
  const s = Math.min(600, Math.max(80, Number(size) || 240));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&data=${encodeURIComponent(data)}`;
}

export function consumerAppBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_CONSUMER_APP_URL,
    process.env.APP_BASE_URL,
    'https://finmemory.com.br',
  ];
  for (const raw of candidates) {
    const u = String(raw || '').trim().replace(/\/$/, '');
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
  }
  return 'https://finmemory.com.br';
}

export function retailerAppBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_RETAILER_APP_URL,
    process.env.NEXT_PUBLIC_FINMEMORY_RETAILER_URL,
    process.env.FINMEMORY_RETAILER_CLOUD_RUN_URL,
    'https://finmemorycomerciantes-836908221936.southamerica-east1.run.app',
  ];
  for (const raw of candidates) {
    const u = String(raw || '').trim().replace(/\/$/, '');
    if (u.startsWith('http://') || u.startsWith('https://')) {
      if (/parceiros\.finmemory\.com\.br/i.test(u)) continue;
      return u;
    }
  }
  return 'https://finmemorycomerciantes-836908221936.southamerica-east1.run.app';
}

export function buildStorePublicPath(slug) {
  return `/loja/${encodeURIComponent(slug)}`;
}

export function buildStorePublicUrl(slug, { src } = {}) {
  const path = buildStorePublicPath(slug);
  const base = consumerAppBaseUrl();
  if (src) return `${base}${path}?src=${encodeURIComponent(src)}`;
  return `${base}${path}`;
}

export function buildPedirUrl(storeId, { origem } = {}) {
  const base = retailerAppBaseUrl();
  const params = new URLSearchParams({ loja: storeId });
  if (origem) params.set('origem', String(origem));
  return `${base}/parceiros/pedir?${params.toString()}`;
}

export function whatsappMeUrl(phoneDigits, text) {
  const digits = normalizeWhatsappDigits(phoneDigits);
  if (!digits) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${q}`;
}
